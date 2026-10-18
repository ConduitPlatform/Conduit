import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertGuestAllowed,
  assertValidSlug,
  buildEffectiveSettings,
  defaultRealmSettings,
  evaluateGuestAllowed,
  evaluateRealmAccess,
  homeScopedQuery,
  isValidSlug,
  nearestRealmInChain,
  normalizeSlug,
  type RealmAccessInput,
  type RealmPolicies,
  type RealmSettingsData,
} from './realm.logic.js';

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

describe('homeScopedQuery', () => {
  it('scopes to a realm id', () => {
    assert.deepEqual(homeScopedQuery(A), { homeRealm: A });
  });

  it('matches both null and missing for global', () => {
    const expected = { $or: [{ homeRealm: null }, { homeRealm: { $exists: false } }] };
    assert.deepEqual(homeScopedQuery(null), expected);
    assert.deepEqual(homeScopedQuery(undefined), expected);
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
