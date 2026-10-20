import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOAuthSecretsUpdate,
  evaluateLinkEligibility,
  type LinkEligibilityInput,
  assertGuestAllowed,
  assertRealmId,
  assertValidSlug,
  BoundedTtlCache,
  buildEffectiveSettings,
  collectTeamChain,
  computeIdentityMode,
  computeRealmsEnabled,
  defaultRealmSettings,
  findBatchPrincipalClashes,
  findIdentifierCollisions,
  findPrincipalClash,
  GLOBAL_REALM_SCOPE,
  identifierQueriesOf,
  identityModeRevertBlockedMessage,
  isGlobalRealmScope,
  isIdentityModeRevertTransition,
  evaluateGuestAllowed,
  evaluateRealmAccess,
  hasNestedRealmViolation,
  homeScopedQuery,
  isRealmId,
  isRealmsDisableTransition,
  isValidSlug,
  maskRealmSettings,
  mergeOAuthSecrets,
  nearestRealmInChain,
  normalizeIdList,
  normalizeSlug,
  realmsDisableBlockedMessage,
  shouldCheckRealmAccess,
  splitRealmSettingsInput,
  subtreeContainsRealm,
  toFullLeafStrategies,
  tokenAssurance,
  unresolvedRealmError,
  uniquenessQuery,
  withHomeScope,
  type RealmAccessInput,
  type RealmPolicies,
  type RealmSettingsData,
  type RealmTeamNode,
  type StoredRealmSettingsData,
} from './realm.logic.js';
import { hasCompleteOAuthCredentials } from '../handlers/oauth2/utils/oauthSettings.logic.js';

const A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const C = 'cccccccccccccccccccccccc';

function policies(overrides: Partial<RealmPolicies> = {}): RealmPolicies {
  return { ...defaultRealmSettings().policies, ...overrides };
}

function access(overrides: Partial<RealmAccessInput> = {}): RealmAccessInput {
  return {
    requestedRealm: A,
    userHomeRealm: A,
    membershipType: null,
    policies: policies(),
    homePolicies: policies(),
    assurance: { authorized: true, hasTwoFA: false, isVerified: true, clientId: 'web' },
    ...overrides,
  };
}

function settings(overrides: Partial<RealmSettingsData> = {}): RealmSettingsData {
  return { ...defaultRealmSettings(), ...overrides };
}

describe('computeRealmsEnabled', () => {
  it('requires both teams and realms to be enabled', () => {
    assert.equal(
      computeRealmsEnabled({ enabled: true, realms: { enabled: true } }),
      true,
    );
    assert.equal(
      computeRealmsEnabled({ enabled: false, realms: { enabled: true } }),
      false,
    );
    assert.equal(
      computeRealmsEnabled({ enabled: true, realms: { enabled: false } }),
      false,
    );
  });

  it('is off for missing or non-boolean config', () => {
    assert.equal(computeRealmsEnabled(undefined), false);
    assert.equal(computeRealmsEnabled(null), false);
    assert.equal(computeRealmsEnabled({ enabled: true }), false);
    assert.equal(computeRealmsEnabled({ realms: { enabled: true } }), false);
    assert.equal(
      computeRealmsEnabled({ enabled: 'true', realms: { enabled: true } }),
      false,
    );
  });
});

describe('slugs', () => {
  it('accepts lowercase alphanumerics with inner dashes', () => {
    for (const slug of ['ab', 'acme', 'acme-corp', 'a1', '9lives', 'a'.repeat(63)]) {
      assert.equal(isValidSlug(slug), true, slug);
    }
  });

  it('rejects malformed slugs', () => {
    for (const slug of [
      '',
      'a',
      '-acme',
      'Acme',
      'ac me',
      'acme_corp',
      'acme/corp',
      'a'.repeat(64),
      'ünï',
    ]) {
      assert.equal(isValidSlug(slug), false, slug);
    }
    assert.equal(isValidSlug(undefined), false);
    assert.equal(isValidSlug(12), false);
  });

  it('normalizes case and surrounding whitespace', () => {
    assert.equal(normalizeSlug('  Acme-Corp '), 'acme-corp');
  });

  it('assertValidSlug returns the normalized slug or throws', () => {
    assert.equal(assertValidSlug(' Acme '), 'acme');
    assert.throws(() => assertValidSlug('-bad'));
    assert.throws(() => assertValidSlug(undefined));
  });

  it('reserves the global scope name', () => {
    assert.equal(GLOBAL_REALM_SCOPE, 'global');
    assert.equal(isValidSlug('global'), false);
    assert.equal(isValidSlug('global-corp'), true);
    assert.throws(() => assertValidSlug(' Global '));
  });
});

describe('isGlobalRealmScope', () => {
  it('matches the global scope name, ignoring case and spaces', () => {
    assert.equal(isGlobalRealmScope('global'), true);
    assert.equal(isGlobalRealmScope(' GLOBAL '), true);
  });

  it('does not match slugs, ids, or absent values', () => {
    assert.equal(isGlobalRealmScope('acme'), false);
    assert.equal(isGlobalRealmScope(A), false);
    assert.equal(isGlobalRealmScope(''), false);
    assert.equal(isGlobalRealmScope(undefined), false);
    assert.equal(isGlobalRealmScope(null), false);
  });
});

describe('homeScopedQuery / withHomeScope', () => {
  const globalScope = {
    $and: [{ $or: [{ homeRealm: null }, { homeRealm: { $exists: false } }] }],
  };

  it('scopes to a realm id', () => {
    assert.deepEqual(homeScopedQuery(A), { homeRealm: A });
  });

  it('matches both null and missing for global, without a top-level $or', () => {
    assert.deepEqual(homeScopedQuery(null), globalScope);
    assert.deepEqual(homeScopedQuery(undefined), globalScope);
    assert.equal('$or' in homeScopedQuery(null), false);
  });

  it('withHomeScope keeps the caller $or next to the global scope', () => {
    const callerOr = [{ email: 'a@b.c' }, { username: 'abc' }];
    assert.deepEqual(withHomeScope({ $or: callerOr }, null), {
      $or: callerOr,
      $and: [{ $or: [{ homeRealm: null }, { homeRealm: { $exists: false } }] }],
    });
  });

  it('withHomeScope appends to an existing $and instead of replacing it', () => {
    const result = withHomeScope({ $and: [{ active: true }], email: 'x' }, null);
    assert.deepEqual(result, {
      email: 'x',
      $and: [
        { active: true },
        { $or: [{ homeRealm: null }, { homeRealm: { $exists: false } }] },
      ],
    });
    assert.deepEqual(withHomeScope({ $and: [{ active: true }] }, A), {
      $and: [{ active: true }, { homeRealm: A }],
    });
  });

  it('withHomeScope handles empty queries and does not mutate its input', () => {
    assert.deepEqual(withHomeScope(undefined, A), { $and: [{ homeRealm: A }] });
    assert.deepEqual(withHomeScope(null, null), globalScope);
    const query = { $and: [{ active: true }] };
    withHomeScope(query, null);
    assert.deepEqual(query, { $and: [{ active: true }] });
  });

  it('withHomeScope cannot be bypassed by a caller homeRealm filter', () => {
    const result = withHomeScope({ homeRealm: B }, A);
    assert.deepEqual(result, { homeRealm: B, $and: [{ homeRealm: A }] });
  });
});

describe('normalizeIdList', () => {
  it('handles missing and non-array values', () => {
    for (const value of [undefined, null, 'a;b', 5, {}, true]) {
      assert.deepEqual(normalizeIdList(value), [], String(value));
    }
  });

  it('drops the empty entry SQL produces for an empty list', () => {
    assert.deepEqual(normalizeIdList(['']), []);
    assert.deepEqual(normalizeIdList(['a', '', ' ', 'b']), ['a', 'b']);
  });

  it('stringifies and trims', () => {
    const oid = { toString: () => A };
    assert.deepEqual(normalizeIdList([oid, ' web ', 12, null, undefined]), [
      A,
      'web',
      '12',
    ]);
  });
});

describe('realm ids', () => {
  it('accepts ObjectIds, numeric ids and uuids', () => {
    for (const id of [
      A,
      'AAAAAAAAAAAAAAAAAAAAAAAA',
      '12',
      42,
      '0b8c9a3e-1f2d-4c5b-8a6e-7d9f0a1b2c3d',
    ]) {
      assert.equal(isRealmId(id), true, String(id));
      assert.equal(assertRealmId(id), String(id));
    }
  });

  it('rejects slugs and junk with INVALID_ARGUMENT', () => {
    for (const id of [
      'acme-corp',
      '',
      'zzzzzzzzzzzzzzzzzzzzzzzz',
      null,
      undefined,
      {},
      'a b',
    ]) {
      assert.equal(isRealmId(id), false, String(id));
      assert.throws(
        () => assertRealmId(id),
        (e: any) => e.code === 3 && e.message === 'realm must be a realm team id',
      );
    }
  });
});

describe('defaultRealmSettings', () => {
  it('follows the contract defaults', () => {
    const d = defaultRealmSettings();
    assert.equal(d.active, true);
    assert.equal(d.strategies.local.enabled, true);
    assert.equal(d.strategies.username.enabled, false);
    assert.equal(d.strategies.magicLink.enabled, false);
    assert.equal(d.strategies.phone.enabled, false);
    assert.equal(d.strategies.metamask.enabled, false);
    assert.equal(d.strategies.biometric.enabled, false);
    assert.deepEqual(d.registration, { allowWithoutInvite: false });
    assert.deepEqual(d.policies, {
      requireTwoFa: false,
      requireVerifiedEmail: false,
      allowedClientIds: [],
      guests: { allowed: true, allowedHomeRealms: [], directSignIn: true },
    });
  });

  it('returns independent objects', () => {
    defaultRealmSettings().policies.allowedClientIds.push('x');
    assert.deepEqual(defaultRealmSettings().policies.allowedClientIds, []);
  });
});

describe('buildEffectiveSettings', () => {
  const globalConfig = {
    local: { enabled: true, verification: { required: true } },
    google: {
      enabled: true,
      clientId: 'global-id',
      clientSecret: 'global-secret',
      redirect_uri: 'https://global/cb',
      accountLinking: true,
    },
    github: { enabled: true, clientId: 'gh-id', clientSecret: 'gh-secret' },
    apple: {
      enabled: true,
      clientId: 'apple-global',
      clientSecret: '',
      privateKey: 'global-key',
      teamId: 'global-team',
      keyId: 'global-kid',
    },
  };

  it('does not inherit global enablement', () => {
    const effective = buildEffectiveSettings(globalConfig, settings());
    assert.equal(effective.strategies.oauth.google.enabled, false);
    assert.equal(effective.strategies.oauth.github.enabled, false);
    assert.equal(effective.strategies.local.enabled, true);
    assert.equal(effective.strategies.magicLink.enabled, false);
  });

  it('enables exactly what the realm enables', () => {
    const effective = buildEffectiveSettings(
      { ...globalConfig, local: { enabled: false } },
      settings({
        strategies: {
          ...defaultRealmSettings().strategies,
          local: { enabled: false },
          phone: { enabled: true },
          oauth: { google: { enabled: true } },
        },
      }),
    );
    assert.equal(effective.strategies.local.enabled, false);
    assert.equal(effective.strategies.phone.enabled, true);
    assert.equal(effective.strategies.oauth.google.enabled, true);
    assert.equal(effective.strategies.oauth.github.enabled, false);
  });

  it('inherits oauth credentials from global when the realm leaves them empty', () => {
    const effective = buildEffectiveSettings(
      globalConfig,
      settings({
        strategies: {
          ...defaultRealmSettings().strategies,
          oauth: { google: { enabled: true, clientId: '', clientSecret: undefined } },
        },
      }),
    );
    const google = effective.strategies.oauth.google;
    assert.equal(google.clientId, 'global-id');
    assert.equal(google.clientSecret, 'global-secret');
    assert.equal(google.redirect_uri, 'https://global/cb');
    assert.equal(google.accountLinking, true);
  });

  it('prefers realm credentials over global ones', () => {
    const effective = buildEffectiveSettings(
      globalConfig,
      settings({
        strategies: {
          ...defaultRealmSettings().strategies,
          oauth: {
            google: {
              enabled: true,
              clientId: 'realm-id',
              clientSecret: 'realm-secret',
              redirect_uri: 'https://realm/cb',
              accountLinking: false,
            },
          },
        },
      }),
    );
    assert.deepEqual(effective.strategies.oauth.google, {
      enabled: true,
      clientId: 'realm-id',
      clientSecret: 'realm-secret',
      redirect_uri: 'https://realm/cb',
      accountLinking: false,
    });
  });

  it('treats apple private key, team id and key id as one credential set', () => {
    const partial = buildEffectiveSettings(
      globalConfig,
      settings({
        strategies: {
          ...defaultRealmSettings().strategies,
          oauth: { apple: { enabled: true, clientId: 'realm-apple', privateKey: 'k' } },
        },
      }),
    ).strategies.oauth.apple;
    assert.equal(partial.clientId, 'realm-apple');
    assert.equal(partial.privateKey, 'global-key');
    assert.equal(partial.teamId, 'global-team');
    assert.equal(partial.keyId, 'global-kid');

    const own = buildEffectiveSettings(
      globalConfig,
      settings({
        strategies: {
          ...defaultRealmSettings().strategies,
          oauth: {
            apple: {
              enabled: true,
              privateKey: 'k',
              teamId: 't',
              keyId: 'i',
            },
          },
        },
      }),
    ).strategies.oauth.apple;
    assert.equal(own.privateKey, 'k');
    assert.equal(own.teamId, 't');
    assert.equal(own.keyId, 'i');
  });

  it('falls back to global email verification unless the realm overrides it', () => {
    assert.equal(
      buildEffectiveSettings(globalConfig, settings()).strategies.local
        .verificationRequired,
      true,
    );
    const overridden = buildEffectiveSettings(
      globalConfig,
      settings({
        strategies: {
          ...defaultRealmSettings().strategies,
          local: { enabled: true, verificationRequired: false },
        },
      }),
    );
    assert.equal(overridden.strategies.local.verificationRequired, false);
  });

  it('carries registration and policies over', () => {
    const effective = buildEffectiveSettings(
      globalConfig,
      settings({
        registration: { allowWithoutInvite: true },
        policies: policies({
          requireTwoFa: true,
          allowedClientIds: ['web'],
          guests: { allowed: false, allowedHomeRealms: [B], directSignIn: true },
        }),
      }),
    );
    assert.equal(effective.registration.allowWithoutInvite, true);
    assert.equal(effective.policies.requireTwoFa, true);
    assert.deepEqual(effective.policies.allowedClientIds, ['web']);
    assert.deepEqual(effective.policies.guests, {
      allowed: false,
      allowedHomeRealms: [B],
      directSignIn: true,
    });
  });
});

describe('evaluateGuestAllowed / assertGuestAllowed', () => {
  it('allows any home realm, including global, when the list is empty', () => {
    const p = policies();
    assert.deepEqual(evaluateGuestAllowed(p, null), { allowed: true });
    assert.deepEqual(evaluateGuestAllowed(p, B), { allowed: true });
  });

  it('rejects everyone when guests are not allowed', () => {
    const p = policies({
      guests: { allowed: false, allowedHomeRealms: [], directSignIn: true },
    });
    assert.deepEqual(evaluateGuestAllowed(p, B), {
      allowed: false,
      error: 'GUESTS_NOT_ALLOWED',
    });
    assert.throws(() => assertGuestAllowed(p, B));
  });

  it('only trusts listed home realms and rejects global users then', () => {
    const p = policies({
      guests: { allowed: true, allowedHomeRealms: [B], directSignIn: true },
    });
    assert.deepEqual(evaluateGuestAllowed(p, B), { allowed: true });
    assert.deepEqual(evaluateGuestAllowed(p, C), {
      allowed: false,
      error: 'GUESTS_NOT_ALLOWED',
    });
    assert.deepEqual(evaluateGuestAllowed(p, null), {
      allowed: false,
      error: 'GUESTS_NOT_ALLOWED',
    });
    assert.doesNotThrow(() => assertGuestAllowed(p, B));
    assert.throws(() => assertGuestAllowed(p, C));
  });
});

describe('evaluateRealmAccess', () => {
  const denied = { allowed: false, error: 'REALM_ACCESS_DENIED' };

  describe('global requests', () => {
    it('allows a global user on a global route', () => {
      assert.deepEqual(
        evaluateRealmAccess(
          access({ requestedRealm: null, userHomeRealm: null, policies: null }),
        ),
        { allowed: true },
      );
    });

    it('denies a realm user on a global route', () => {
      assert.deepEqual(
        evaluateRealmAccess(
          access({ requestedRealm: null, userHomeRealm: A, policies: null }),
        ),
        denied,
      );
    });
  });

  describe('home realm', () => {
    it('allows a home user into their home realm without a membership lookup', () => {
      assert.deepEqual(evaluateRealmAccess(access()), { allowed: true });
    });

    it('ignores guest policies for home users', () => {
      const p = policies({
        guests: { allowed: false, allowedHomeRealms: [B], directSignIn: true },
      });
      assert.deepEqual(evaluateRealmAccess(access({ policies: p })), { allowed: true });
    });

    it('still applies the realm policies to home users', () => {
      const p = policies({ requireVerifiedEmail: true });
      const result = evaluateRealmAccess(
        access({
          policies: p,
          assurance: {
            authorized: true,
            hasTwoFA: false,
            isVerified: false,
            clientId: 'web',
          },
        }),
      );
      assert.deepEqual(result, denied);
    });

    it('fails closed when the policies could not be resolved', () => {
      assert.deepEqual(evaluateRealmAccess(access({ policies: null })), denied);
    });
  });

  describe('guests', () => {
    const guest = (overrides: Partial<RealmAccessInput> = {}) =>
      access({
        requestedRealm: A,
        userHomeRealm: B,
        membershipType: 'guest',
        ...overrides,
      });

    it('allows a guest with a guest membership', () => {
      assert.deepEqual(evaluateRealmAccess(guest()), { allowed: true });
    });

    it('denies a home user of another realm without a membership', () => {
      assert.deepEqual(evaluateRealmAccess(guest({ membershipType: null })), denied);
    });

    it('denies when the only membership is not a guest one', () => {
      assert.deepEqual(evaluateRealmAccess(guest({ membershipType: 'home' })), denied);
    });

    it('lets a global user enter a realm as a guest', () => {
      assert.deepEqual(evaluateRealmAccess(guest({ userHomeRealm: null })), {
        allowed: true,
      });
    });

    it('denies a global user without a membership', () => {
      assert.deepEqual(
        evaluateRealmAccess(guest({ userHomeRealm: null, membershipType: null })),
        denied,
      );
    });

    it('applies the guest policy', () => {
      const closed = policies({
        guests: { allowed: false, allowedHomeRealms: [], directSignIn: true },
      });
      assert.deepEqual(evaluateRealmAccess(guest({ policies: closed })), {
        allowed: false,
        error: 'GUESTS_NOT_ALLOWED',
      });
      const trusted = policies({
        guests: { allowed: true, allowedHomeRealms: [C], directSignIn: true },
      });
      assert.deepEqual(evaluateRealmAccess(guest({ policies: trusted })), {
        allowed: false,
        error: 'GUESTS_NOT_ALLOWED',
      });
      const trustsHome = policies({
        guests: { allowed: true, allowedHomeRealms: [B], directSignIn: true },
      });
      assert.deepEqual(evaluateRealmAccess(guest({ policies: trustsHome })), {
        allowed: true,
      });
    });
  });

  describe('policies', () => {
    const assurance = (overrides = {}) => ({
      authorized: true,
      hasTwoFA: true,
      isVerified: true,
      clientId: 'web',
      ...overrides,
    });

    it('requireTwoFa: a user without 2FA must enrol', () => {
      const p = policies({ requireTwoFa: true });
      assert.deepEqual(
        evaluateRealmAccess(
          access({ policies: p, assurance: assurance({ hasTwoFA: false }) }),
        ),
        { allowed: false, error: 'TWO_FA_REQUIRED_FOR_REALM' },
      );
    });

    it('requireTwoFa: an unauthorized session is denied', () => {
      const p = policies({ requireTwoFa: true });
      assert.deepEqual(
        evaluateRealmAccess(
          access({ policies: p, assurance: assurance({ authorized: false }) }),
        ),
        denied,
      );
    });

    it('requireTwoFa: allows a user with 2FA and an authorized session', () => {
      const p = policies({ requireTwoFa: true });
      assert.deepEqual(
        evaluateRealmAccess(access({ policies: p, assurance: assurance() })),
        {
          allowed: true,
        },
      );
    });

    it('requireTwoFa: is not enforced when the policy is off', () => {
      assert.deepEqual(
        evaluateRealmAccess(
          access({ assurance: assurance({ hasTwoFA: false, authorized: false }) }),
        ),
        { allowed: true },
      );
    });

    it('requireVerifiedEmail', () => {
      const p = policies({ requireVerifiedEmail: true });
      assert.deepEqual(
        evaluateRealmAccess(
          access({ policies: p, assurance: assurance({ isVerified: false }) }),
        ),
        denied,
      );
      assert.deepEqual(
        evaluateRealmAccess(access({ policies: p, assurance: assurance() })),
        {
          allowed: true,
        },
      );
    });

    it('allowedClientIds: empty means any client', () => {
      assert.deepEqual(
        evaluateRealmAccess(access({ assurance: assurance({ clientId: 'whatever' }) })),
        { allowed: true },
      );
    });

    it('allowedClientIds: pins the client when set', () => {
      const p = policies({ allowedClientIds: ['web', 'ios'] });
      assert.deepEqual(
        evaluateRealmAccess(
          access({ policies: p, assurance: assurance({ clientId: 'ios' }) }),
        ),
        { allowed: true },
      );
      assert.deepEqual(
        evaluateRealmAccess(
          access({ policies: p, assurance: assurance({ clientId: 'android' }) }),
        ),
        denied,
      );
    });

    it('accepts ObjectId-like ids by comparing their string forms', () => {
      const id = { toString: () => A } as unknown as string;
      assert.deepEqual(
        evaluateRealmAccess(access({ requestedRealm: A, userHomeRealm: id })),
        { allowed: true },
      );
    });
  });
});

describe('guest sessions and the home realm policies', () => {
  const session = (overrides: Partial<RealmAccessInput> = {}) =>
    access({
      requestedRealm: A,
      userHomeRealm: B,
      membershipType: 'guest',
      ...overrides,
    });
  const assurance = (overrides = {}) => ({
    authorized: true,
    hasTwoFA: true,
    isVerified: true,
    clientId: 'web',
    ...overrides,
  });

  it('allows a guest when both realms are open', () => {
    assert.deepEqual(evaluateRealmAccess(session()), { allowed: true });
  });

  it('applies the 2FA rule of the home realm', () => {
    const home = policies({ requireTwoFa: true });
    assert.deepEqual(
      evaluateRealmAccess(
        session({ homePolicies: home, assurance: assurance({ hasTwoFA: false }) }),
      ),
      { allowed: false, error: 'TWO_FA_REQUIRED_FOR_REALM' },
    );
    assert.deepEqual(
      evaluateRealmAccess(
        session({ homePolicies: home, assurance: assurance({ authorized: false }) }),
      ),
      { allowed: false, error: 'REALM_ACCESS_DENIED' },
    );
    assert.deepEqual(
      evaluateRealmAccess(session({ homePolicies: home, assurance: assurance() })),
      { allowed: true },
    );
  });

  it('applies the verified email rule of the home realm', () => {
    const home = policies({ requireVerifiedEmail: true });
    assert.deepEqual(
      evaluateRealmAccess(
        session({ homePolicies: home, assurance: assurance({ isVerified: false }) }),
      ),
      { allowed: false, error: 'REALM_ACCESS_DENIED' },
    );
  });

  it('applies the client pinning of the home realm', () => {
    const home = policies({ allowedClientIds: ['mobile'] });
    assert.deepEqual(
      evaluateRealmAccess(
        session({ homePolicies: home, assurance: assurance({ clientId: 'web' }) }),
      ),
      { allowed: false, error: 'REALM_ACCESS_DENIED' },
    );
    assert.deepEqual(
      evaluateRealmAccess(
        session({ homePolicies: home, assurance: assurance({ clientId: 'mobile' }) }),
      ),
      { allowed: true },
    );
  });

  it('applies the policies of the requested realm as well', () => {
    const own = policies({ requireVerifiedEmail: true });
    assert.deepEqual(
      evaluateRealmAccess(
        session({ policies: own, assurance: assurance({ isVerified: false }) }),
      ),
      { allowed: false, error: 'REALM_ACCESS_DENIED' },
    );
  });

  it('returns the requested realm refusal first when both realms refuse', () => {
    const own = policies({ requireTwoFa: true });
    const home = policies({ requireVerifiedEmail: true });
    assert.deepEqual(
      evaluateRealmAccess(
        session({
          policies: own,
          homePolicies: home,
          assurance: assurance({ hasTwoFA: false, isVerified: false }),
        }),
      ),
      { allowed: false, error: 'TWO_FA_REQUIRED_FOR_REALM' },
    );
  });

  it('keeps the guest policy of the requested realm ahead of the home policies', () => {
    const closed = policies({
      guests: { allowed: false, allowedHomeRealms: [], directSignIn: true },
    });
    assert.deepEqual(
      evaluateRealmAccess(session({ policies: closed, homePolicies: null })),
      {
        allowed: false,
        error: 'GUESTS_NOT_ALLOWED',
      },
    );
  });

  it('fails closed when the home realm policies could not be resolved', () => {
    assert.deepEqual(evaluateRealmAccess(session({ homePolicies: null })), {
      allowed: false,
      error: 'REALM_ACCESS_DENIED',
    });
  });

  it('does not read the home policies of a global user entering as a guest', () => {
    assert.deepEqual(
      evaluateRealmAccess(session({ userHomeRealm: null, homePolicies: null })),
      { allowed: true },
    );
  });

  it('does not apply home policies on the home realm itself', () => {
    // the home realm's own policies are the requested ones: the separate home slot is unused
    const home = policies({ requireTwoFa: true });
    assert.deepEqual(
      evaluateRealmAccess(
        access({
          requestedRealm: B,
          userHomeRealm: B,
          policies: policies(),
          homePolicies: home,
          assurance: assurance({ hasTwoFA: false }),
        }),
      ),
      { allowed: true },
    );
  });
});

describe('nearestRealmInChain', () => {
  it('returns the first realm on the chain', () => {
    const chain = [
      { _id: 'c', parentTeam: 'b' },
      { _id: 'b', parentTeam: 'a', realm: { enabled: false } },
      { _id: 'a', realm: { enabled: true, slug: 'acme' } },
    ];
    assert.equal(nearestRealmInChain(chain)?._id, 'a');
  });

  it('returns null when no team is a realm', () => {
    assert.equal(nearestRealmInChain([{ _id: 'a' }, { _id: 'b', realm: null }]), null);
    assert.equal(nearestRealmInChain([]), null);
  });
});

describe('SQL primitive array tolerance', () => {
  // MySQL/MariaDB/SQLite join primitive arrays with ';': [] reads back as [''] and a
  // missing value as null/undefined.
  const sqlPolicies = (clients: unknown, homes: unknown) =>
    ({
      ...defaultRealmSettings().policies,
      allowedClientIds: clients,
      guests: { allowed: true, allowedHomeRealms: homes, directSignIn: true },
    }) as unknown as RealmPolicies;

  it('buildEffectiveSettings normalizes [""], null and undefined lists', () => {
    for (const value of [[''], null, undefined, [' ']]) {
      const effective = buildEffectiveSettings(
        {},
        settings({ policies: sqlPolicies(value, value) }),
      );
      assert.deepEqual(effective.policies.allowedClientIds, [], String(value));
      assert.deepEqual(effective.policies.guests.allowedHomeRealms, [], String(value));
    }
  });

  it('buildEffectiveSettings keeps real ids and stringifies them', () => {
    const oid = { toString: () => B };
    const effective = buildEffectiveSettings(
      {},
      settings({ policies: sqlPolicies(['web', ''], [oid, '']) }),
    );
    assert.deepEqual(effective.policies.allowedClientIds, ['web']);
    assert.deepEqual(effective.policies.guests.allowedHomeRealms, [B]);
  });

  it('buildEffectiveSettings survives missing policies and strategies', () => {
    const effective = buildEffectiveSettings({}, {
      active: true,
    } as unknown as RealmSettingsData);
    assert.deepEqual(effective.policies.allowedClientIds, []);
    assert.equal(effective.policies.guests.allowed, true);
  });

  it('evaluateGuestAllowed treats [""] and null as "any home realm"', () => {
    for (const value of [[''], null, undefined]) {
      const p = sqlPolicies([], value);
      assert.deepEqual(evaluateGuestAllowed(p, null), { allowed: true }, String(value));
      assert.deepEqual(evaluateGuestAllowed(p, B), { allowed: true }, String(value));
      assert.doesNotThrow(() => assertGuestAllowed(p, null));
    }
  });

  it('evaluateGuestAllowed still filters when real ids sit next to the empty entry', () => {
    const p = sqlPolicies([], ['', B]);
    assert.deepEqual(evaluateGuestAllowed(p, B), { allowed: true });
    assert.deepEqual(evaluateGuestAllowed(p, C), {
      allowed: false,
      error: 'GUESTS_NOT_ALLOWED',
    });
  });

  it('evaluateRealmAccess treats allowedClientIds [""] and null as "any client"', () => {
    for (const value of [[''], null, undefined]) {
      assert.deepEqual(
        evaluateRealmAccess(
          access({
            policies: sqlPolicies(value, []),
            assurance: {
              authorized: true,
              hasTwoFA: false,
              isVerified: true,
              clientId: 'anything',
            },
          }),
        ),
        { allowed: true },
        String(value),
      );
    }
  });

  it('evaluateRealmAccess still pins the client next to the empty entry', () => {
    const p = sqlPolicies(['', 'web'], []);
    const withClient = (clientId: string) =>
      access({
        policies: p,
        assurance: { authorized: true, hasTwoFA: false, isVerified: true, clientId },
      });
    assert.deepEqual(evaluateRealmAccess(withClient('web')), { allowed: true });
    assert.deepEqual(evaluateRealmAccess(withClient('')), {
      allowed: false,
      error: 'REALM_ACCESS_DENIED',
    });
  });
});

describe('evaluateRealmAccess edge cases', () => {
  const denied = { allowed: false, error: 'REALM_ACCESS_DENIED' };

  it('treats a guest membership row for the own home realm as home, not guest', () => {
    // guests are not allowed, which would deny a real guest
    const closed = policies({
      guests: { allowed: false, allowedHomeRealms: [C], directSignIn: true },
    });
    assert.deepEqual(
      evaluateRealmAccess(
        access({
          requestedRealm: A,
          userHomeRealm: A,
          membershipType: 'guest',
          policies: closed,
        }),
      ),
      { allowed: true },
    );
  });

  it('treats an empty home realm as global', () => {
    assert.deepEqual(
      evaluateRealmAccess(
        access({ requestedRealm: null, userHomeRealm: '', policies: null }),
      ),
      { allowed: true },
    );
    assert.deepEqual(
      evaluateRealmAccess(access({ userHomeRealm: '', membershipType: 'guest' })),
      { allowed: true },
    );
    assert.deepEqual(
      evaluateRealmAccess(access({ userHomeRealm: '', membershipType: null })),
      denied,
    );
  });

  it('treats an empty requested realm as global', () => {
    assert.deepEqual(
      evaluateRealmAccess(
        access({ requestedRealm: '', userHomeRealm: null, policies: null }),
      ),
      { allowed: true },
    );
    assert.deepEqual(
      evaluateRealmAccess(
        access({ requestedRealm: '', userHomeRealm: A, policies: null }),
      ),
      denied,
    );
  });

  it('an unresolvable home realm is a denial, any other one is not found', () => {
    assert.equal(unresolvedRealmError(A, A), 'REALM_ACCESS_DENIED');
    assert.equal(unresolvedRealmError(A, B), 'REALM_NOT_FOUND');
    assert.equal(unresolvedRealmError(A, null), 'REALM_NOT_FOUND');
  });
});

describe('token issuance decisions', () => {
  it('shouldCheckRealmAccess skips when the feature flag is off', () => {
    assert.equal(
      shouldCheckRealmAccess({ realmsEnabled: false, realm: A, homeRealm: A }),
      false,
    );
  });

  it('shouldCheckRealmAccess skips when both realms are empty', () => {
    for (const empty of [null, undefined, '']) {
      assert.equal(
        shouldCheckRealmAccess({ realmsEnabled: true, realm: empty, homeRealm: empty }),
        false,
      );
    }
  });

  it('shouldCheckRealmAccess checks when either realm is set', () => {
    assert.equal(
      shouldCheckRealmAccess({ realmsEnabled: true, realm: A, homeRealm: '' }),
      true,
    );
    assert.equal(
      shouldCheckRealmAccess({ realmsEnabled: true, realm: null, homeRealm: B }),
      true,
    );
  });

  it('tokenAssurance: users without 2FA are authorized', () => {
    assert.deepEqual(tokenAssurance({ hasTwoFA: false }), {
      authorized: true,
      realmAuthorized: true,
    });
  });

  it('tokenAssurance: a partial token is unauthorized but passes the realm check', () => {
    assert.deepEqual(tokenAssurance({ hasTwoFA: true }), {
      authorized: false,
      realmAuthorized: true,
    });
    assert.deepEqual(tokenAssurance({ hasTwoFA: true, twoFaPass: false }), {
      authorized: false,
      realmAuthorized: true,
    });
  });

  it('tokenAssurance: 2FA pass and refresh authorize', () => {
    assert.deepEqual(tokenAssurance({ hasTwoFA: true, twoFaPass: true }), {
      authorized: true,
      realmAuthorized: true,
    });
    assert.deepEqual(tokenAssurance({ hasTwoFA: true, isRefresh: true }), {
      authorized: true,
      realmAuthorized: true,
    });
  });

  it('a partial token still fails requireTwoFa for users without 2FA only', () => {
    const p = policies({ requireTwoFa: true });
    const evaluate = (hasTwoFA: boolean) =>
      evaluateRealmAccess(
        access({
          policies: p,
          assurance: {
            authorized: tokenAssurance({ hasTwoFA }).realmAuthorized,
            hasTwoFA,
            isVerified: true,
            clientId: 'web',
          },
        }),
      );
    assert.deepEqual(evaluate(true), { allowed: true });
    assert.deepEqual(evaluate(false), {
      allowed: false,
      error: 'TWO_FA_REQUIRED_FOR_REALM',
    });
  });
});

describe('oauth secrets', () => {
  const stored = (): StoredRealmSettingsData => ({
    active: true,
    strategies: {
      ...defaultRealmSettings().strategies,
      oauth: {
        google: { enabled: true, clientId: 'gid' },
        apple: { enabled: true, clientId: 'aid', teamId: 't', keyId: 'k' },
      },
    },
    registration: { allowWithoutInvite: false },
    policies: defaultRealmSettings().policies,
    linking: defaultRealmSettings().linking,
  });
  const secrets = () => ({
    google: { clientSecret: 'gsecret' },
    apple: { privateKey: 'akey', clientSecret: 'asecret' },
  });

  it('mergeOAuthSecrets puts the secrets back into the oauth entries', () => {
    const merged = mergeOAuthSecrets(stored(), secrets());
    assert.equal(merged.strategies.oauth.google?.clientSecret, 'gsecret');
    assert.equal(merged.strategies.oauth.apple?.privateKey, 'akey');
    assert.equal(merged.strategies.oauth.google?.clientId, 'gid');
    const effective = buildEffectiveSettings({}, merged);
    assert.equal(effective.strategies.oauth.google.clientSecret, 'gsecret');
    assert.equal(effective.strategies.oauth.apple.privateKey, 'akey');
  });

  it('mergeOAuthSecrets tolerates missing secrets and ignores unknown providers', () => {
    for (const value of [null, undefined, {}]) {
      assert.deepEqual(
        mergeOAuthSecrets(stored(), value).strategies,
        stored().strategies,
      );
    }
    const merged = mergeOAuthSecrets(stored(), {
      nope: { clientSecret: 'x' },
      github: { clientSecret: 'ghs' },
    } as any);
    assert.equal('nope' in merged.strategies.oauth, false);
    assert.deepEqual(merged.strategies.oauth.github, {
      enabled: false,
      clientSecret: 'ghs',
    });
  });

  it('mergeOAuthSecrets does not mutate its input', () => {
    const input = stored();
    mergeOAuthSecrets(input, secrets());
    assert.deepEqual(input, stored());
  });

  it('maskRealmSettings reports has* flags and never a secret value', () => {
    const masked = maskRealmSettings({
      _id: A,
      team: B,
      ...stored(),
      oauthSecrets: secrets(),
    });
    assert.equal('oauthSecrets' in masked, false);
    assert.deepEqual(masked.strategies.oauth.google, {
      enabled: true,
      clientId: 'gid',
      hasClientSecret: true,
    });
    assert.deepEqual(masked.strategies.oauth.apple, {
      enabled: true,
      clientId: 'aid',
      teamId: 't',
      keyId: 'k',
      hasClientSecret: true,
      hasPrivateKey: true,
    });
    assert.equal((masked as any)._id, A);
    assert.equal((masked as any).team, B);
    assert.equal(JSON.stringify(masked).includes('secret'), false);
    assert.equal(JSON.stringify(masked).includes('akey'), false);
  });

  it('maskRealmSettings flags absent secrets as false and works without oauthSecrets', () => {
    const masked = maskRealmSettings(stored());
    assert.equal(masked.strategies.oauth.google?.hasClientSecret, false);
    assert.equal(masked.strategies.oauth.apple?.hasPrivateKey, false);
    assert.equal('hasPrivateKey' in (masked.strategies.oauth.google ?? {}), false);
    const empty = maskRealmSettings({
      ...stored(),
      oauthSecrets: { google: { clientSecret: '' } },
    });
    assert.equal(empty.strategies.oauth.google?.hasClientSecret, false);
  });

  it('maskRealmSettings also masks secrets found inside merged settings', () => {
    const masked = maskRealmSettings(mergeOAuthSecrets(stored(), secrets()));
    assert.equal(masked.strategies.oauth.google?.hasClientSecret, true);
    assert.equal(JSON.stringify(masked).includes('gsecret'), false);
  });

  it('maskRealmSettings does not mutate its input', () => {
    const input = { ...stored(), oauthSecrets: secrets() };
    maskRealmSettings(input);
    assert.deepEqual(input, { ...stored(), oauthSecrets: secrets() });
  });

  it('splitRealmSettingsInput moves secrets out and drops read-only flags', () => {
    const { settings, oauthSecrets } = splitRealmSettingsInput({
      active: true,
      strategies: {
        local: { enabled: true },
        oauth: {
          google: {
            enabled: true,
            clientId: 'gid',
            clientSecret: 'gsecret',
            hasClientSecret: true,
          },
          apple: { enabled: true, privateKey: 'akey', hasPrivateKey: true, keyId: 'k' },
          github: { enabled: false },
        },
      },
      policies: { requireTwoFa: true, guests: { allowed: false } },
      registration: { allowWithoutInvite: true },
    });
    assert.deepEqual(oauthSecrets, {
      google: { clientSecret: 'gsecret' },
      apple: { privateKey: 'akey' },
    });
    assert.deepEqual(settings, {
      active: true,
      strategies: {
        local: { enabled: true },
        oauth: {
          google: { enabled: true, clientId: 'gid' },
          apple: { enabled: true, keyId: 'k' },
          github: { enabled: false },
        },
      },
      policies: { requireTwoFa: true, guests: { allowed: false } },
      registration: { allowWithoutInvite: true },
    });
  });

  it('splitRealmSettingsInput carries only settings keys and ignores injected oauthSecrets', () => {
    const { settings, oauthSecrets } = splitRealmSettingsInput({
      slug: 'acme',
      force: true,
      oauthSecrets: { google: { clientSecret: 'injected' } },
      active: false,
    } as any);
    assert.deepEqual(settings, { active: false });
    assert.deepEqual(oauthSecrets, {});
    assert.deepEqual(splitRealmSettingsInput(undefined), {
      settings: {},
      oauthSecrets: {},
    });
  });

  it('split then merge then mask round-trips', () => {
    const input = {
      strategies: {
        oauth: {
          google: { enabled: true, clientId: 'gid', clientSecret: 'gsecret' },
          apple: { enabled: true, privateKey: 'akey', teamId: 't', keyId: 'k' },
        },
      },
    };
    const { settings, oauthSecrets } = splitRealmSettingsInput(input);
    const doc = {
      ...stored(),
      strategies: { ...stored().strategies, oauth: settings.strategies!.oauth! },
    } as StoredRealmSettingsData;
    const merged = mergeOAuthSecrets(doc, oauthSecrets);
    assert.equal(merged.strategies.oauth.google?.clientSecret, 'gsecret');
    assert.equal(merged.strategies.oauth.apple?.privateKey, 'akey');
    const masked = maskRealmSettings({ ...doc, oauthSecrets });
    assert.equal(masked.strategies.oauth.google?.hasClientSecret, true);
    assert.equal(masked.strategies.oauth.apple?.hasPrivateKey, true);
    assert.equal(JSON.stringify(masked).includes('gsecret'), false);
  });

  it('applyOAuthSecretsUpdate replaces, clears and keeps secrets', () => {
    const existing = {
      google: { clientSecret: 'old' },
      apple: { privateKey: 'k', clientSecret: 's' },
    };
    const result = applyOAuthSecretsUpdate(existing, {
      google: { clientSecret: 'new' },
      apple: { clientSecret: '' },
      github: { clientSecret: 'gh' },
    });
    assert.deepEqual(result, {
      google: { clientSecret: 'new' },
      apple: { privateKey: 'k' },
      github: { clientSecret: 'gh' },
    });
    assert.deepEqual(existing.google, { clientSecret: 'old' });
  });

  it('applyOAuthSecretsUpdate drops providers left empty and tolerates no stored secrets', () => {
    assert.deepEqual(
      applyOAuthSecretsUpdate(
        { google: { clientSecret: 'x' } },
        { google: { clientSecret: '' } },
      ),
      {},
    );
    assert.deepEqual(applyOAuthSecretsUpdate(null, {}), {});
    assert.deepEqual(
      applyOAuthSecretsUpdate(undefined, { google: { clientSecret: 'a' } }),
      {
        google: { clientSecret: 'a' },
      },
    );
  });
});

describe('team tree', () => {
  const node = (id: string, parentTeam?: string, realm = false): RealmTeamNode => ({
    _id: id,
    parentTeam: parentTeam ?? null,
    realm: realm ? { enabled: true, slug: id } : undefined,
  });

  const tree = (...nodes: RealmTeamNode[]) => {
    const byId = new Map(nodes.map(n => [n._id, n]));
    return {
      byId,
      fetchTeam: async (id: string) => byId.get(id) ?? null,
      fetchChildren: async (parentIds: string[]) =>
        nodes.filter(n => n.parentTeam && parentIds.includes(String(n.parentTeam))),
    };
  };

  const violation = (
    t: ReturnType<typeof tree>,
    teamId: string,
    parentTeamId?: string | null,
    promote?: boolean,
  ) =>
    hasNestedRealmViolation({
      team: t.byId.get(teamId)!,
      parentTeamId,
      promote,
      fetchTeam: t.fetchTeam,
      fetchChildren: t.fetchChildren,
    });

  it('collectTeamChain walks up to and including the first realm', async () => {
    const t = tree(node('r', undefined, true), node('a', 'r'), node('b', 'a'));
    const chain = await collectTeamChain('b', t.fetchTeam);
    assert.deepEqual(
      chain.map(n => n._id),
      ['b', 'a', 'r'],
    );
    assert.equal(nearestRealmInChain(chain)?._id, 'r');
  });

  it('collectTeamChain survives cycles and missing parents', async () => {
    const cyclic = tree(node('a', 'b'), node('b', 'a'));
    assert.deepEqual(
      (await collectTeamChain('a', cyclic.fetchTeam)).map(n => n._id),
      ['a', 'b'],
    );
    const orphan = tree(node('a', 'gone'));
    assert.deepEqual(
      (await collectTeamChain('a', orphan.fetchTeam)).map(n => n._id),
      ['a'],
    );
    assert.deepEqual(await collectTeamChain('nope', orphan.fetchTeam), []);
  });

  it('subtreeContainsRealm finds deep realms and ignores the root itself', async () => {
    const t = tree(
      node('root', undefined, true),
      node('a', 'root'),
      node('b', 'a'),
      node('c', 'b', true),
    );
    assert.equal(await subtreeContainsRealm('root', t.fetchChildren), true);
    assert.equal(await subtreeContainsRealm('b', t.fetchChildren), true);
    assert.equal(await subtreeContainsRealm('c', t.fetchChildren), false);
    assert.equal(await subtreeContainsRealm('x', t.fetchChildren), false);
  });

  it('subtreeContainsRealm is cycle safe', async () => {
    const t = tree(node('a', 'b'), node('b', 'a'));
    assert.equal(await subtreeContainsRealm('a', t.fetchChildren), false);
  });

  it('allows promoting a top-level team without realm descendants', async () => {
    const t = tree(node('a'), node('b', 'a'));
    assert.equal(await violation(t, 'a', undefined, true), false);
  });

  it('rejects promoting a team that has a parent', async () => {
    const t = tree(node('a'), node('b', 'a'));
    assert.equal(await violation(t, 'b', undefined, true), true);
  });

  it('rejects promoting a team with a realm descendant', async () => {
    const t = tree(node('a'), node('b', 'a'), node('c', 'b', true));
    assert.equal(await violation(t, 'a', undefined, true), true);
  });

  it('rejects moving a realm below another team, allows moving it to the top', async () => {
    const t = tree(node('r', undefined, true), node('x'));
    assert.equal(await violation(t, 'r', 'x'), true);
    assert.equal(await violation(t, 'r', null), false);
  });

  it('rejects moving a team under a realm when its subtree holds a realm', async () => {
    const t = tree(
      node('r', undefined, true),
      node('a'),
      node('b', 'a'),
      node('c', 'b', true),
    );
    assert.equal(await violation(t, 'a', 'r'), true);
  });

  it('allows moving a plain team under a realm or a plain team', async () => {
    const t = tree(node('r', undefined, true), node('a'), node('x'));
    assert.equal(await violation(t, 'a', 'r'), false);
    assert.equal(await violation(t, 'a', 'x'), false);
  });

  it('validates a team where it sits when no new parent is given', async () => {
    const t = tree(node('r', undefined, true), node('a', 'r'));
    assert.equal(await violation(t, 'a'), false);
    assert.equal(await violation(t, 'r'), false);
    // a realm that somehow has a parent is invalid
    const broken = tree(node('p'), node('r', 'p', true));
    assert.equal(await violation(broken, 'r'), true);
  });
});

describe('BoundedTtlCache', () => {
  it('returns clones, so callers cannot mutate shared state', () => {
    const cache = new BoundedTtlCache<{ list: string[] }>(10);
    const original = { list: ['a'] };
    cache.set('k', original, 1000);
    original.list.push('mutated-after-set');
    const first = cache.get('k')!;
    assert.deepEqual(first, { list: ['a'] });
    first.list.push('mutated-after-get');
    assert.deepEqual(cache.get('k'), { list: ['a'] });
  });

  it('expires entries on read', () => {
    let now = 1000;
    const cache = new BoundedTtlCache<string>(10, () => now);
    cache.set('k', 'v', 100);
    assert.equal(cache.get('k'), 'v');
    now = 1100;
    assert.equal(cache.get('k'), undefined);
    assert.equal(cache.size, 0);
  });

  it('does not cache with a ttl of 0', () => {
    const cache = new BoundedTtlCache<string>(10);
    cache.set('k', 'v', 0);
    assert.equal(cache.get('k'), undefined);
    assert.equal(cache.size, 0);
  });

  it('drops the oldest entry once full', () => {
    const cache = new BoundedTtlCache<string>(3);
    for (const key of ['a', 'b', 'c', 'd']) cache.set(key, key, 1000);
    assert.equal(cache.size, 3);
    assert.equal(cache.get('a'), undefined);
    assert.equal(cache.get('d'), 'd');
    // rewriting a key refreshes it instead of evicting another one
    cache.set('b', 'b2', 1000);
    cache.set('e', 'e', 1000);
    assert.equal(cache.get('b'), 'b2');
    assert.equal(cache.get('c'), undefined);
  });

  it('caches null values', () => {
    const cache = new BoundedTtlCache<string | null>(3);
    cache.set('k', null, 1000);
    assert.equal(cache.get('k'), null);
  });

  it('clear drops everything', () => {
    const cache = new BoundedTtlCache<string>(3);
    cache.set('a', 'a', 1000);
    cache.clear();
    assert.equal(cache.get('a'), undefined);
  });
});

// Not covered here (needs the database, grantRealmMembership is IO around the pure
// guest policy checks above): membership idempotency, assertSlugAvailable and
// assertSlugUniqueAfterWrite, the TokenProvider wiring. The decisions they delegate to
// (shouldCheckRealmAccess, tokenAssurance, unresolvedRealmError, evaluateGuestAllowed)
// are tested above.

describe('buildEffectiveSettings credential pairing', () => {
  const globalConfig = {
    google: {
      enabled: true,
      clientId: 'global-id',
      clientSecret: 'global-secret',
      redirect_uri: 'https://global/cb',
    },
    apple: {
      enabled: true,
      clientId: 'apple-global',
      privateKey: 'global-key',
      teamId: 'global-team',
      keyId: 'global-kid',
    },
  };
  const withOauth = (oauth: Record<string, any>) => ({
    ...defaultRealmSettings(),
    strategies: { ...defaultRealmSettings().strategies, oauth },
  });

  it('takes the secret only from the realm when the realm sets its own clientId', () => {
    const google = buildEffectiveSettings(
      globalConfig,
      withOauth({ google: { enabled: true, clientId: 'realm-id' } }),
    ).strategies.oauth.google;
    assert.equal(google.clientId, 'realm-id');
    // never the global secret with a foreign clientId
    assert.equal(google.clientSecret, '');
    assert.equal(hasCompleteOAuthCredentials('google', google), false);
  });

  it('uses the realm pair when both are set', () => {
    const google = buildEffectiveSettings(
      globalConfig,
      withOauth({
        google: { enabled: true, clientId: 'realm-id', clientSecret: 'realm-secret' },
      }),
    ).strategies.oauth.google;
    assert.equal(google.clientId, 'realm-id');
    assert.equal(google.clientSecret, 'realm-secret');
    assert.equal(hasCompleteOAuthCredentials('google', google), true);
  });

  it('ignores a realm secret without a clientId and inherits both', () => {
    const google = buildEffectiveSettings(
      globalConfig,
      withOauth({ google: { enabled: true, clientSecret: 'orphan' } }),
    ).strategies.oauth.google;
    assert.equal(google.clientId, 'global-id');
    assert.equal(google.clientSecret, 'global-secret');
  });

  it('does not infect other providers or other realms', () => {
    const effective = buildEffectiveSettings(
      { ...globalConfig, github: { clientId: 'gh', clientSecret: 'ghs' } },
      withOauth({ google: { enabled: true, clientId: 'realm-id' } }),
    );
    assert.equal(effective.strategies.oauth.github.clientSecret, 'ghs');
  });

  it('keeps the Apple key triple all-or-nothing', () => {
    const partial = buildEffectiveSettings(
      globalConfig,
      withOauth({
        apple: { enabled: true, clientId: 'svc', teamId: 'T', keyId: 'K' },
      }),
    ).strategies.oauth.apple;
    assert.equal(partial.privateKey, 'global-key');
    assert.equal(partial.teamId, 'global-team');
    assert.equal(partial.keyId, 'global-kid');
    const own = buildEffectiveSettings(
      globalConfig,
      withOauth({
        apple: { enabled: true, privateKey: 'P', teamId: 'T', keyId: 'K' },
      }),
    ).strategies.oauth.apple;
    assert.deepEqual([own.privateKey, own.teamId, own.keyId], ['P', 'T', 'K']);
  });
});

describe('explicit null leaves', () => {
  const nullGoogle = {
    enabled: true,
    clientId: null,
    redirect_uri: null,
    accountLinking: null,
  };

  it('buildEffectiveSettings treats null credentials and overrides as unset', () => {
    const effective = buildEffectiveSettings(
      {
        google: {
          clientId: 'global-id',
          clientSecret: 'global-secret',
          redirect_uri: 'https://global/cb',
          accountLinking: false,
        },
        apple: {
          clientId: 'g',
          privateKey: 'gk',
          teamId: 'gt',
          keyId: 'gkid',
        },
        local: { verification: { required: true } },
      },
      settings({
        strategies: {
          ...defaultRealmSettings().strategies,
          local: { enabled: true, verificationRequired: null } as any,
          oauth: {
            google: nullGoogle,
            apple: { enabled: true, clientId: null, teamId: null, keyId: null },
          } as any,
        },
      }),
    );
    assert.equal(effective.strategies.local.verificationRequired, true);
    const google = effective.strategies.oauth.google;
    assert.equal(google.enabled, true);
    assert.equal(google.clientId, 'global-id');
    assert.equal(google.clientSecret, 'global-secret');
    assert.equal(google.redirect_uri, 'https://global/cb');
    assert.equal(google.accountLinking, false);
    const apple = effective.strategies.oauth.apple;
    assert.equal(apple.privateKey, 'gk');
    assert.equal(apple.teamId, 'gt');
    assert.equal(apple.keyId, 'gkid');
  });

  it('maskRealmSettings omits null credentials and overrides from the read shape', () => {
    const masked = maskRealmSettings({
      ...defaultRealmSettings(),
      strategies: {
        ...defaultRealmSettings().strategies,
        local: { enabled: true, verificationRequired: null },
        oauth: { google: { ...nullGoogle, clientId: 'own' }, apple: nullGoogle },
      },
      oauthSecrets: { google: { clientSecret: 's' } },
    } as any);
    assert.deepEqual(masked.strategies.local, { enabled: true });
    assert.deepEqual(masked.strategies.oauth.google, {
      enabled: true,
      clientId: 'own',
      hasClientSecret: true,
    });
    assert.deepEqual(masked.strategies.oauth.apple, {
      enabled: true,
      hasClientSecret: false,
      hasPrivateKey: false,
    });
  });

  it('splitRealmSettingsInput carries null credentials through to the patch', () => {
    const { settings: patch } = splitRealmSettingsInput({
      strategies: { oauth: { google: { clientId: null, accountLinking: null } } },
    } as any);
    assert.deepEqual(patch.strategies?.oauth?.google, {
      clientId: null,
      accountLinking: null,
    });
  });
});

describe('toFullLeafStrategies', () => {
  const full = (partial: any = {}) =>
    toFullLeafStrategies({ ...defaultRealmSettings().strategies, ...partial } as any);

  it('has every provider, disabled with null credentials when the input lacks it', () => {
    const result = full();
    assert.deepEqual(Object.keys(result.oauth).sort(), [
      'apple',
      'bitbucket',
      'facebook',
      'figma',
      'github',
      'gitlab',
      'google',
      'linkedin',
      'microsoft',
      'reddit',
      'slack',
      'twitch',
      'twitter',
    ]);
    assert.deepEqual(result.oauth.google, {
      enabled: false,
      clientId: null,
      redirect_uri: null,
      accountLinking: null,
    });
    assert.deepEqual(result.oauth.apple, {
      enabled: false,
      clientId: null,
      redirect_uri: null,
      accountLinking: null,
      teamId: null,
      keyId: null,
    });
  });

  it('keeps what the input sets and nulls the rest of the provider', () => {
    const result = full({
      oauth: { google: { enabled: true, clientId: 'id', redirect_uri: undefined } },
    });
    assert.deepEqual(result.oauth.google, {
      enabled: true,
      clientId: 'id',
      redirect_uri: null,
      accountLinking: null,
    });
  });

  it('writes local.verificationRequired as null when the input has none', () => {
    assert.deepEqual(full().local, { enabled: true, verificationRequired: null });
    assert.deepEqual(
      full({ local: { enabled: false, verificationRequired: true } }).local,
      { enabled: false, verificationRequired: true },
    );
  });

  it('does not mutate its input and fills missing toggles', () => {
    const input: any = { local: { enabled: true }, oauth: {} };
    const result = toFullLeafStrategies(input);
    assert.deepEqual(input, { local: { enabled: true }, oauth: {} });
    assert.deepEqual(result.username, { enabled: false });
    assert.deepEqual(result.biometric, { enabled: false });
  });
});

describe('isRealmsDisableTransition / realmsDisableBlockedMessage', () => {
  const on = { enabled: true, realms: { enabled: true } };

  it('is true when the update switches realms or teams off while they were on', () => {
    assert.equal(isRealmsDisableTransition(on, { realms: { enabled: false } }), true);
    assert.equal(
      isRealmsDisableTransition(on, { enabled: true, realms: { enabled: false } }),
      true,
    );
    assert.equal(isRealmsDisableTransition(on, { enabled: false }), true);
    assert.equal(
      isRealmsDisableTransition(on, { enabled: false, realms: { enabled: true } }),
      true,
    );
  });

  it('is false for updates that keep realms on, partial or not', () => {
    assert.equal(isRealmsDisableTransition(on, undefined), false);
    assert.equal(isRealmsDisableTransition(on, {}), false);
    assert.equal(isRealmsDisableTransition(on, { realms: {} }), false);
    assert.equal(isRealmsDisableTransition(on, { realms: { enabled: true } }), false);
  });

  it('is false when realms were not on, so no database call is made', () => {
    assert.equal(
      isRealmsDisableTransition(undefined, { realms: { enabled: false } }),
      false,
    );
    assert.equal(
      isRealmsDisableTransition(
        { enabled: false, realms: { enabled: true } },
        { realms: { enabled: false } },
      ),
      false,
    );
    assert.equal(
      isRealmsDisableTransition(
        { enabled: true, realms: { enabled: false } },
        { enabled: false },
      ),
      false,
    );
  });

  it('blocks only while enabled realms exist', () => {
    assert.equal(realmsDisableBlockedMessage(0), null);
    assert.equal(
      realmsDisableBlockedMessage(3),
      '3 enabled realm(s) exist; demote them before disabling realms',
    );
  });
});

describe('uniquenessQuery', () => {
  const identifier = { email: 'a@example.com' };

  it('returns the identifier query itself in shared mode, whatever the realm', () => {
    assert.equal(uniquenessQuery(identifier, null, 'shared'), identifier);
    assert.equal(uniquenessQuery(identifier, A, 'shared'), identifier);
  });

  it('scopes to the home realm in isolated mode', () => {
    assert.deepEqual(uniquenessQuery(identifier, A, 'isolated'), {
      email: 'a@example.com',
      $and: [{ homeRealm: A }],
    });
  });

  it('scopes to global users in isolated mode when there is no realm', () => {
    assert.deepEqual(uniquenessQuery(identifier, null, 'isolated'), {
      email: 'a@example.com',
      $and: [{ $or: [{ homeRealm: null }, { homeRealm: { $exists: false } }] }],
    });
  });

  it('keeps the caller $and clauses in isolated mode', () => {
    const query = { email: 'a', $and: [{ active: true }] };
    assert.deepEqual(uniquenessQuery(query, B, 'isolated').$and, [
      { active: true },
      { homeRealm: B },
    ]);
  });

  it('does not mutate the input query', () => {
    const query = { email: 'a' };
    uniquenessQuery(query, A, 'isolated');
    assert.deepEqual(query, { email: 'a' });
  });
});

describe('computeIdentityMode', () => {
  it('is shared while realms are off, whatever identityMode holds', () => {
    assert.equal(
      computeIdentityMode({
        enabled: true,
        realms: { enabled: false, identityMode: 'isolated' },
      }),
      'shared',
    );
    assert.equal(
      computeIdentityMode({
        enabled: false,
        realms: { enabled: true, identityMode: 'isolated' },
      }),
      'shared',
    );
    assert.equal(computeIdentityMode(null), 'shared');
  });

  it('reads isolated only when realms are on and the value says so', () => {
    const on = { enabled: true, realms: { enabled: true } };
    assert.equal(
      computeIdentityMode({ ...on, realms: { enabled: true, identityMode: 'isolated' } }),
      'isolated',
    );
    assert.equal(
      computeIdentityMode({ ...on, realms: { enabled: true, identityMode: 'shared' } }),
      'shared',
    );
    assert.equal(
      computeIdentityMode({ ...on, realms: { enabled: true, identityMode: 'other' } }),
      'shared',
    );
    assert.equal(computeIdentityMode(on), 'shared');
  });
});

describe('isIdentityModeRevertTransition', () => {
  // applied configs with realms and teams on, in the given identity mode
  const isolated = { enabled: true, realms: { enabled: true, identityMode: 'isolated' } };
  const shared = { enabled: true, realms: { enabled: true, identityMode: 'shared' } };

  it('is true only for isolated -> shared', () => {
    assert.equal(isIdentityModeRevertTransition(isolated, shared), true);
    assert.equal(isIdentityModeRevertTransition(shared, isolated), false);
    assert.equal(isIdentityModeRevertTransition(isolated, isolated), false);
    assert.equal(isIdentityModeRevertTransition(shared, shared), false);
  });

  it('is true when realms are disabled while isolated', () => {
    const update = { realms: { enabled: false } };
    assert.equal(isIdentityModeRevertTransition(isolated, update), true);
    assert.equal(
      isIdentityModeRevertTransition(isolated, {
        enabled: true,
        realms: { enabled: false, identityMode: 'isolated' },
      }),
      true,
    );
  });

  it('is true when teams are disabled while isolated', () => {
    assert.equal(isIdentityModeRevertTransition(isolated, { enabled: false }), true);
    assert.equal(
      isIdentityModeRevertTransition(isolated, {
        enabled: false,
        realms: { enabled: true, identityMode: 'isolated' },
      }),
      true,
    );
  });

  it('is true when the update returns to shared and disables realms together', () => {
    const update = { realms: { enabled: false, identityMode: 'shared' } };
    assert.equal(isIdentityModeRevertTransition(isolated, update), true);
  });

  it('keeps the applied value when the update does not name the flags', () => {
    assert.equal(isIdentityModeRevertTransition(isolated, {}), false);
    assert.equal(isIdentityModeRevertTransition(isolated, { realms: {} }), false);
    assert.equal(isIdentityModeRevertTransition(isolated, undefined), false);
    assert.equal(isIdentityModeRevertTransition(isolated, null), false);
  });

  it('treats an unset previous value as shared', () => {
    assert.equal(isIdentityModeRevertTransition(undefined, shared), false);
    assert.equal(isIdentityModeRevertTransition({}, { realms: {} }), false);
  });

  it('judges the computed mode: a stored isolated value with realms off is shared', () => {
    const realmsOff = {
      enabled: true,
      realms: { enabled: false, identityMode: 'isolated' },
    };
    assert.equal(isIdentityModeRevertTransition(realmsOff, shared), false);
  });

  it('is false when realms are enabled again from off', () => {
    const realmsOff = {
      enabled: true,
      realms: { enabled: false, identityMode: 'isolated' },
    };
    assert.equal(isIdentityModeRevertTransition(realmsOff, isolated), false);
  });
});

describe('identityModeRevertBlockedMessage', () => {
  it('allows the switch when nothing is held twice', () => {
    assert.equal(identityModeRevertBlockedMessage(0), null);
    assert.equal(identityModeRevertBlockedMessage(-1), null);
  });

  it('names the number of duplicated identifiers', () => {
    assert.equal(
      identityModeRevertBlockedMessage(3),
      '3 identifier(s) are held by more than one account; identity mode cannot return to shared',
    );
  });
});

describe('findIdentifierCollisions', () => {
  it('matches emails case-insensitively', () => {
    const result = findIdentifierCollisions([
      [
        { _id: '1', email: 'A@Example.com' },
        { _id: '2', email: 'a@example.com' },
      ],
    ]);
    assert.equal(result.byKind.email, 1);
    assert.equal(result.total, 1);
  });

  it('matches usernames case-insensitively and wallets in lowercase', () => {
    const result = findIdentifierCollisions([
      [
        { _id: '1', username: 'Alice', metamask: { ethPublicAddress: '0xABC' } },
        { _id: '2', username: 'alice', metamask: { ethPublicAddress: '0xabc' } },
      ],
    ]);
    assert.equal(result.byKind.username, 1);
    assert.equal(result.byKind.metamask, 1);
    assert.equal(result.total, 2);
  });

  it('matches phone numbers exactly', () => {
    const result = findIdentifierCollisions([
      [
        { _id: '1', phoneNumber: '+30123' },
        { _id: '2', phoneNumber: '+30 123' },
        { _id: '3', phoneNumber: '+30123' },
      ],
    ]);
    assert.equal(result.byKind.phoneNumber, 1);
  });

  it('ignores null, empty and blank values', () => {
    const result = findIdentifierCollisions([
      [
        { _id: '1', email: null, phoneNumber: '', username: '   ', metamask: null },
        {
          _id: '2',
          email: '',
          phoneNumber: null,
          username: '   ',
          metamask: { ethPublicAddress: '' },
        },
        { _id: '3', email: undefined, google: { id: null } },
        { _id: '4', google: { id: '' } },
      ],
    ]);
    assert.equal(result.total, 0);
  });

  it('keeps identifier kinds apart', () => {
    const sameText = findIdentifierCollisions([
      [
        { _id: '1', email: 'x' },
        { _id: '2', username: 'x' },
      ],
    ]);
    assert.equal(sameText.total, 0);
  });

  it('counts OAuth ids per provider', () => {
    const samePerProvider = findIdentifierCollisions([
      [
        { _id: '1', google: { id: 'g1' } },
        { _id: '2', google: { id: 'g1' } },
      ],
    ]);
    assert.equal(samePerProvider.byKind['oauth.google'], 1);
    assert.equal(samePerProvider.total, 1);

    const otherProvider = findIdentifierCollisions([
      [
        { _id: '1', github: { id: 'g1' } },
        { _id: '2', google: { id: 'g1' } },
      ],
    ]);
    assert.equal(otherProvider.total, 0);
  });

  it('counts global and realm users together', () => {
    const result = findIdentifierCollisions([
      [
        { _id: '1', email: 'a@x.io' },
        { _id: '2', email: 'a@x.io', homeRealm: A },
        { _id: '3', email: 'a@x.io', homeRealm: B },
        { _id: '4', email: 'b@x.io', homeRealm: A },
      ],
    ]);
    assert.equal(result.byKind.email, 1);
    assert.equal(result.total, 1);
  });

  it('counts a value once however many users hold it', () => {
    const result = findIdentifierCollisions([
      [
        { _id: '1', email: 'a' },
        { _id: '2', email: 'a' },
        { _id: '3', email: 'a' },
      ],
      [
        { _id: '4', email: 'b' },
        { _id: '5', email: 'b' },
      ],
    ]);
    assert.equal(result.byKind.email, 2);
    assert.equal(result.total, 2);
  });

  it('finds collisions across batches', () => {
    const result = findIdentifierCollisions([
      [{ _id: '1', email: 'a' }],
      [{ _id: '2', email: 'A' }],
    ]);
    assert.equal(result.total, 1);
  });

  it('does not count one user twice when batches overlap', () => {
    const result = findIdentifierCollisions([
      [{ _id: '1', email: 'a' }],
      [{ _id: '1', email: 'a' }],
    ]);
    assert.equal(result.total, 0);
  });

  it('counts users without an id as distinct holders', () => {
    const result = findIdentifierCollisions([[{ email: 'a' }, { email: 'a' }]]);
    assert.equal(result.total, 1);
  });

  it('reports every kind, zero when clean', () => {
    const result = findIdentifierCollisions([[{ _id: '1', email: 'a' }]]);
    assert.equal(result.total, 0);
    assert.equal(result.byKind.email, 0);
    assert.equal(result.byKind.phoneNumber, 0);
    assert.equal(result.byKind['oauth.apple'], 0);
  });
});

describe('identifierQueriesOf', () => {
  it('lists every identifier the user holds with the query that finds it', () => {
    assert.deepEqual(
      identifierQueriesOf({
        _id: 'u1',
        email: 'a@x.io',
        phoneNumber: '+30123',
        username: 'alice',
        metamask: { ethPublicAddress: '0xabc' },
        google: { id: 'g1' },
      }),
      [
        { kind: 'email', query: { email: 'a@x.io' } },
        { kind: 'phoneNumber', query: { phoneNumber: '+30123' } },
        { kind: 'username', query: { username: 'alice' } },
        { kind: 'metamask', query: { 'metamask.ethPublicAddress': '0xabc' } },
        { kind: 'oauth.google', query: { 'google.id': 'g1' } },
      ],
    );
  });

  it('skips absent, null and blank identifiers', () => {
    assert.deepEqual(
      identifierQueriesOf({
        _id: 'u1',
        email: '',
        phoneNumber: null,
        username: '   ',
        metamask: { ethPublicAddress: null },
        google: { id: undefined },
        github: null,
      }),
      [],
    );
  });

  it('keeps one entry per provider and the stored value as it is', () => {
    const queries = identifierQueriesOf({
      _id: 'u1',
      email: 'Mixed@X.io',
      github: { id: '42' },
      google: { id: 'g1' },
    });
    assert.deepEqual(queries, [
      { kind: 'email', query: { email: 'Mixed@X.io' } },
      { kind: 'oauth.github', query: { 'github.id': '42' } },
      { kind: 'oauth.google', query: { 'google.id': 'g1' } },
    ]);
  });
});

describe('findPrincipalClash', () => {
  const holder = (id: string, homeRealm: string | null) => ({ _id: id, homeRealm });
  const isolatedAt = (realmId: string | null, extra: object = {}) => ({
    mode: 'isolated' as const,
    realmId,
    holders: [] as { _id: string; homeRealm: string | null }[],
    guestUserIds: [] as string[],
    ...extra,
  });

  it('never clashes in shared mode', () => {
    assert.equal(
      findPrincipalClash({
        ...isolatedAt(A, { holders: [holder('u1', A)], guestUserIds: ['u2'] }),
        mode: 'shared',
      }),
      null,
    );
  });

  it('reports a home account of the realm', () => {
    assert.equal(
      findPrincipalClash(isolatedAt(A, { holders: [holder('u1', A)] })),
      'home',
    );
  });

  it('reports a linked guest of the realm', () => {
    assert.equal(
      findPrincipalClash(
        isolatedAt(A, { holders: [holder('u2', B)], guestUserIds: ['u2'] }),
      ),
      'guest',
    );
  });

  it('ignores a holder of another realm that is not a guest here', () => {
    assert.equal(findPrincipalClash(isolatedAt(A, { holders: [holder('u3', B)] })), null);
    assert.equal(
      findPrincipalClash(
        isolatedAt(A, { holders: [holder('u3', B)], guestUserIds: ['u9'] }),
      ),
      null,
    );
  });

  it('never clashes with the account being judged', () => {
    assert.equal(
      findPrincipalClash(
        isolatedAt(A, { holders: [holder('u1', A)], excludeUserId: 'u1' }),
      ),
      null,
    );
    assert.equal(
      findPrincipalClash(
        isolatedAt(A, {
          holders: [holder('u2', B)],
          guestUserIds: ['u2'],
          excludeUserId: 'u2',
        }),
      ),
      null,
    );
  });

  it('reports a home account before a guest', () => {
    assert.equal(
      findPrincipalClash(
        isolatedAt(A, {
          holders: [holder('u2', B), holder('u1', A)],
          guestUserIds: ['u2'],
        }),
      ),
      'home',
    );
  });

  it('the global scope clashes with global holders and has no guests', () => {
    assert.equal(
      findPrincipalClash(isolatedAt(null, { holders: [holder('u1', null)] })),
      'home',
    );
    assert.equal(
      findPrincipalClash(
        isolatedAt(null, { holders: [holder('u2', B)], guestUserIds: ['u2'] }),
      ),
      null,
    );
  });
});

describe('findBatchPrincipalClashes', () => {
  const q = (kind: 'email' | 'username', query: Record<string, string>) => ({
    kind,
    query,
  });

  it('lists the later user sharing an identifier with an earlier one', () => {
    assert.deepEqual(
      findBatchPrincipalClashes([
        { _id: 'u1', queries: [q('email', { email: 'a' })] },
        {
          _id: 'u2',
          queries: [q('email', { email: 'a' }), q('username', { username: 'x' })],
        },
      ]),
      ['u2'],
    );
  });

  it('does not clash over equal values of different kinds', () => {
    assert.deepEqual(
      findBatchPrincipalClashes([
        { _id: 'u1', queries: [q('email', { email: 'x' })] },
        { _id: 'u2', queries: [q('username', { username: 'x' })] },
      ]),
      [],
    );
  });

  it('keeps the first holder standing and lists every later one once', () => {
    assert.deepEqual(
      findBatchPrincipalClashes([
        { _id: 'u1', queries: [q('email', { email: 'a' })] },
        { _id: 'u2', queries: [q('email', { email: 'a' })] },
        { _id: 'u3', queries: [q('email', { email: 'a' })] },
      ]),
      ['u2', 'u3'],
    );
  });
});

describe('linking and direct sign-in settings', () => {
  it('default to no inbound linking, outbound linking and direct guest sign-in', () => {
    const defaults = defaultRealmSettings();
    assert.deepEqual(defaults.linking, { inbound: false, outbound: true });
    assert.equal(defaults.policies.guests.directSignIn, true);
  });

  it('read stored rows without the fields as the defaults', () => {
    const effective = buildEffectiveSettings(
      {},
      {
        ...defaultRealmSettings(),
        linking: undefined as unknown as RealmSettingsData['linking'],
        policies: {
          ...defaultRealmSettings().policies,
          guests: {
            allowed: true,
            allowedHomeRealms: [],
            directSignIn: true,
          } as RealmPolicies['guests'],
        },
      },
    );
    assert.deepEqual(effective.linking, { inbound: false, outbound: true });
    assert.equal(effective.policies.guests.directSignIn, true);
  });

  it('carry explicit values into the effective settings', () => {
    const effective = buildEffectiveSettings(
      {},
      {
        ...defaultRealmSettings(),
        linking: { inbound: true, outbound: false },
        policies: {
          ...defaultRealmSettings().policies,
          guests: { allowed: true, allowedHomeRealms: [], directSignIn: false },
        },
      },
    );
    assert.deepEqual(effective.linking, { inbound: true, outbound: false });
    assert.equal(effective.policies.guests.directSignIn, false);
  });

  it('splitRealmSettingsInput keeps linking in the settings patch', () => {
    assert.deepEqual(splitRealmSettingsInput({ linking: { inbound: true } }).settings, {
      linking: { inbound: true },
    });
  });
});

describe('evaluateLinkEligibility', () => {
  // a link of a home account of A into B, which takes inbound links; A allows outbound links
  function link(overrides: Partial<LinkEligibilityInput> = {}): LinkEligibilityInput {
    return {
      targetRealm: B,
      sourceRealm: A,
      alreadyGuest: false,
      targetInbound: true,
      sourceOutbound: true,
      targetPolicies: policies(),
      sourcePolicies: policies(),
      assurance: { authorized: true, hasTwoFA: false, isVerified: true, clientId: 'web' },
      allowWithoutInvite: true,
      invite: 'none',
      principalClash: false,
      ...overrides,
    };
  }

  it('allows a link that passes every rule', () => {
    assert.deepEqual(evaluateLinkEligibility(link()), { allowed: true });
  });

  it('allows a global account to link into a realm that accepts it', () => {
    assert.deepEqual(
      evaluateLinkEligibility(link({ sourceRealm: null, sourcePolicies: null })),
      { allowed: true },
    );
  });

  it('refuses an account that is already home at the target', () => {
    assert.deepEqual(evaluateLinkEligibility(link({ sourceRealm: B })), {
      allowed: false,
      error: 'LINK_CONFLICT',
    });
  });

  it('refuses an account that is already a guest of the target', () => {
    assert.deepEqual(evaluateLinkEligibility(link({ alreadyGuest: true })), {
      allowed: false,
      error: 'LINK_CONFLICT',
    });
  });

  it('refuses when the target has no inbound linking', () => {
    assert.deepEqual(evaluateLinkEligibility(link({ targetInbound: false })), {
      allowed: false,
      error: 'LINKING_NOT_ALLOWED',
    });
  });

  it('refuses when the source realm has no outbound linking', () => {
    assert.deepEqual(evaluateLinkEligibility(link({ sourceOutbound: false })), {
      allowed: false,
      error: 'LINKING_NOT_ALLOWED',
    });
  });

  it('refuses a source home realm the target guest policy rejects', () => {
    const restricted = link({
      targetPolicies: policies({
        guests: { allowed: true, allowedHomeRealms: [C], directSignIn: true },
      }),
    });
    assert.deepEqual(evaluateLinkEligibility(restricted), {
      allowed: false,
      error: 'GUESTS_NOT_ALLOWED',
    });
    assert.deepEqual(
      evaluateLinkEligibility({
        ...restricted,
        targetPolicies: policies({
          guests: { allowed: true, allowedHomeRealms: [A], directSignIn: true },
        }),
      }),
      { allowed: true },
    );
  });

  it('refuses a target that accepts no guests at all', () => {
    const closed = link({
      targetPolicies: policies({
        guests: { allowed: false, allowedHomeRealms: [], directSignIn: true },
      }),
    });
    assert.deepEqual(evaluateLinkEligibility(closed), {
      allowed: false,
      error: 'GUESTS_NOT_ALLOWED',
    });
  });

  it('refuses a global account when the target only takes realm accounts', () => {
    const realmsOnly = link({
      sourceRealm: null,
      sourcePolicies: null,
      targetPolicies: policies({
        guests: { allowed: true, allowedHomeRealms: [A], directSignIn: true },
      }),
    });
    assert.deepEqual(evaluateLinkEligibility(realmsOnly), {
      allowed: false,
      error: 'GUESTS_NOT_ALLOWED',
    });
  });

  it('applies the policies of the target and of the source home realm to the guest', () => {
    const twoFaTarget = link({
      targetPolicies: policies({ requireTwoFa: true }),
      assurance: { authorized: true, hasTwoFA: false, isVerified: true, clientId: 'web' },
    });
    assert.deepEqual(evaluateLinkEligibility(twoFaTarget), {
      allowed: false,
      error: 'TWO_FA_REQUIRED_FOR_REALM',
    });
    const verifiedSource = link({
      sourcePolicies: policies({ requireVerifiedEmail: true }),
      assurance: {
        authorized: true,
        hasTwoFA: false,
        isVerified: false,
        clientId: 'web',
      },
    });
    assert.deepEqual(evaluateLinkEligibility(verifiedSource), {
      allowed: false,
      error: 'REALM_ACCESS_DENIED',
    });
  });

  it('refuses a source whose realm is unresolved, as the caller reports it', () => {
    assert.deepEqual(
      evaluateLinkEligibility(link({ sourcePolicies: null, sourceOutbound: false })),
      { allowed: false, error: 'LINKING_NOT_ALLOWED' },
    );
  });

  it('needs an invitation unless the target allows registration without one', () => {
    assert.deepEqual(
      evaluateLinkEligibility(link({ allowWithoutInvite: false, invite: 'none' })),
      { allowed: false, error: 'INVITATION_REQUIRED' },
    );
    assert.deepEqual(
      evaluateLinkEligibility(link({ allowWithoutInvite: false, invite: 'inside' })),
      { allowed: true },
    );
  });

  it('refuses an invalid invitation, whatever the registration rule', () => {
    assert.deepEqual(evaluateLinkEligibility(link({ invite: 'invalid' })), {
      allowed: false,
      error: 'INVALID_INVITATION',
    });
    assert.deepEqual(
      evaluateLinkEligibility(link({ allowWithoutInvite: false, invite: 'invalid' })),
      { allowed: false, error: 'INVALID_INVITATION' },
    );
  });

  it('refuses when another principal of the target holds an identifier', () => {
    assert.deepEqual(evaluateLinkEligibility(link({ principalClash: true })), {
      allowed: false,
      error: 'LINK_CONFLICT',
    });
  });

  it('judges the links in order: the conflict of home comes before the linking settings', () => {
    assert.deepEqual(
      evaluateLinkEligibility(link({ sourceRealm: B, targetInbound: false })),
      { allowed: false, error: 'LINK_CONFLICT' },
    );
  });
});
