import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOAuthSecretsUpdate,
  assertGuestAllowed,
  assertRealmId,
  assertValidSlug,
  BoundedTtlCache,
  buildEffectiveSettings,
  collectTeamChain,
  computeRealmsEnabled,
  defaultRealmSettings,
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
  toRealmMembershipDto,
  tokenAssurance,
  unresolvedRealmError,
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
      guests: { allowed: true, allowedHomeRealms: [] },
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
          guests: { allowed: false, allowedHomeRealms: [B] },
        }),
      }),
    );
    assert.equal(effective.registration.allowWithoutInvite, true);
    assert.equal(effective.policies.requireTwoFa, true);
    assert.deepEqual(effective.policies.allowedClientIds, ['web']);
    assert.deepEqual(effective.policies.guests, {
      allowed: false,
      allowedHomeRealms: [B],
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
    const p = policies({ guests: { allowed: false, allowedHomeRealms: [] } });
    assert.deepEqual(evaluateGuestAllowed(p, B), {
      allowed: false,
      error: 'GUESTS_NOT_ALLOWED',
    });
    assert.throws(() => assertGuestAllowed(p, B));
  });

  it('only trusts listed home realms and rejects global users then', () => {
    const p = policies({ guests: { allowed: true, allowedHomeRealms: [B] } });
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
      const p = policies({ guests: { allowed: false, allowedHomeRealms: [B] } });
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
      const closed = policies({ guests: { allowed: false, allowedHomeRealms: [] } });
      assert.deepEqual(evaluateRealmAccess(guest({ policies: closed })), {
        allowed: false,
        error: 'GUESTS_NOT_ALLOWED',
      });
      const trusted = policies({ guests: { allowed: true, allowedHomeRealms: [C] } });
      assert.deepEqual(evaluateRealmAccess(guest({ policies: trusted })), {
        allowed: false,
        error: 'GUESTS_NOT_ALLOWED',
      });
      const trustsHome = policies({ guests: { allowed: true, allowedHomeRealms: [B] } });
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
      guests: { allowed: true, allowedHomeRealms: homes },
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
    const closed = policies({ guests: { allowed: false, allowedHomeRealms: [C] } });
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

describe('toRealmMembershipDto', () => {
  it('maps membershipType to type and stringifies ids and dates', () => {
    const oid = (id: string) => ({ toString: () => id });
    assert.deepEqual(
      toRealmMembershipDto({
        _id: oid(A),
        user: oid(B),
        realm: oid(C),
        membershipType: 'guest',
        createdAt: new Date('2026-01-02T03:04:05.000Z'),
        updatedAt: new Date(),
      } as any),
      {
        _id: A,
        user: B,
        realm: C,
        type: 'guest',
        createdAt: '2026-01-02T03:04:05.000Z',
      },
    );
  });

  it('accepts string dates and omits a missing createdAt', () => {
    const dto = toRealmMembershipDto({
      _id: A,
      user: B,
      realm: C,
      membershipType: 'home',
      createdAt: '2026-01-02T03:04:05Z',
    });
    assert.equal(dto.createdAt, '2026-01-02T03:04:05.000Z');
    assert.equal(
      'createdAt' in
        toRealmMembershipDto({ _id: A, user: B, realm: C, membershipType: 'home' }),
      false,
    );
    assert.equal('membershipType' in dto, false);
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
