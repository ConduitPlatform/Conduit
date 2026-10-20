import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { buildEffectiveSettings, defaultRealmSettings } from '../utils/realm.logic.js';
import {
  anonymousRealmDenial,
  decideGuestPrincipal,
  decideGuestSignIn,
  isGlobalStrategyEnabled,
  isHomeRealm,
  isInviteRequired,
  isStrategyEnabled,
  passwordVerificationRequired,
  reconcileInvitationRealm,
  scopeUserQuery,
} from './realmRequest.logic.js';

const effective = buildEffectiveSettings(
  {},
  {
    ...defaultRealmSettings(),
    strategies: {
      ...defaultRealmSettings().strategies,
      username: { enabled: true },
      oauth: { google: { enabled: true }, github: { enabled: false } },
    },
  },
);

describe('isStrategyEnabled', () => {
  it('reads plain strategies', () => {
    assert.equal(isStrategyEnabled(effective, 'local'), true);
    assert.equal(isStrategyEnabled(effective, 'username'), true);
    assert.equal(isStrategyEnabled(effective, 'phone'), false);
    assert.equal(isStrategyEnabled(effective, 'biometric'), false);
  });

  it('reads oauth providers', () => {
    assert.equal(isStrategyEnabled(effective, 'oauth.google'), true);
    assert.equal(isStrategyEnabled(effective, 'oauth.github'), false);
    assert.equal(isStrategyEnabled(effective, 'oauth.unknown'), false);
  });

  it('never treats the oauth group itself as a strategy', () => {
    assert.equal(isStrategyEnabled(effective, 'oauth'), false);
  });
});

describe('scopeUserQuery', () => {
  it('leaves the query untouched with no realm and realms off', () => {
    const query = { email: 'a@b.c' };
    assert.equal(scopeUserQuery(query, null, false), query);
  });

  it('scopes to global (null or missing) with realms on', () => {
    assert.deepEqual(scopeUserQuery({ email: 'a@b.c' }, null, true), {
      email: 'a@b.c',
      $and: [{ $or: [{ homeRealm: null }, { homeRealm: { $exists: false } }] }],
    });
  });

  it('scopes to a realm', () => {
    assert.deepEqual(scopeUserQuery({ username: 'bob' }, 'r1', true), {
      username: 'bob',
      $and: [{ homeRealm: 'r1' }],
    });
  });
});

describe('isInviteRequired', () => {
  const teams = (enabled: boolean, allowRegistrationWithoutInvite: boolean) => ({
    enabled,
    allowRegistrationWithoutInvite,
  });

  it('follows the global teams config without a realm', () => {
    assert.equal(isInviteRequired(null, teams(true, false)), true);
    assert.equal(isInviteRequired(null, teams(true, true)), false);
    assert.equal(isInviteRequired(null, teams(false, false)), false);
  });

  it('lets the realm override the global setting', () => {
    assert.equal(
      isInviteRequired({ allowWithoutInvite: true }, teams(true, false)),
      false,
    );
    assert.equal(
      isInviteRequired({ allowWithoutInvite: false }, teams(true, true)),
      true,
    );
    assert.equal(
      isInviteRequired({ allowWithoutInvite: false }, teams(false, true)),
      true,
    );
  });

  it('still requires the invitation of a realm when teams are disabled', () => {
    assert.equal(
      isInviteRequired({ allowWithoutInvite: false }, teams(false, false)),
      true,
    );
    assert.equal(
      isInviteRequired({ allowWithoutInvite: true }, teams(false, false)),
      false,
    );
  });
});

describe('reconcileInvitationRealm', () => {
  const invalid = (err: unknown) =>
    err instanceof ModuleError &&
    JSON.parse(err.message).conduitCode === errors.INVALID_INVITATION.conduitCode;

  it('accepts matching realms, including both global', () => {
    assert.equal(reconcileInvitationRealm('r1', 'r1', false), 'r1');
    assert.equal(reconcileInvitationRealm(null, null, false), null);
    assert.equal(reconcileInvitationRealm(undefined, undefined, true), null);
  });

  it('rejects an invitation into a different realm', () => {
    assert.throws(() => reconcileInvitationRealm('r1', 'r2', true), invalid);
    assert.throws(() => reconcileInvitationRealm('r1', 'r2', false), invalid);
  });

  it('keeps the requested realm for an invitation outside any realm', () => {
    assert.equal(reconcileInvitationRealm('r1', null, true), 'r1');
    assert.equal(reconcileInvitationRealm('r1', null, false), 'r1');
    assert.equal(reconcileInvitationRealm('r1', undefined, false), 'r1');
  });

  it('implies the invitation realm only where allowed', () => {
    assert.equal(reconcileInvitationRealm(null, 'r2', true), 'r2');
    assert.throws(() => reconcileInvitationRealm(null, 'r2', false), invalid);
  });
});

describe('isHomeRealm', () => {
  it('treats null and missing as global', () => {
    assert.equal(isHomeRealm(undefined, null), true);
    assert.equal(isHomeRealm(null, undefined), true);
    assert.equal(isHomeRealm('r1', null), false);
    assert.equal(isHomeRealm(null, 'r1'), false);
    assert.equal(isHomeRealm('r1', 'r1'), true);
  });
});

describe('isGlobalStrategyEnabled (assertGlobalStrategyAvailable decision)', () => {
  const on = {
    local: { enabled: true, username_auth_enabled: true },
    magic_link: { enabled: true },
    phoneAuthentication: { enabled: true },
    metamask: { enabled: true },
    biometricAuthentication: { enabled: true },
  };
  const off = {
    local: { enabled: false, username_auth_enabled: false },
    magic_link: { enabled: false },
    phoneAuthentication: { enabled: false },
    metamask: { enabled: false },
    biometricAuthentication: { enabled: false },
  };
  const keys = ['local', 'username', 'magicLink', 'phone', 'metamask', 'biometric'];

  it('reads the right global flag per strategy', () => {
    for (const key of keys) {
      assert.equal(isGlobalStrategyEnabled(on, key), true, key);
      assert.equal(isGlobalStrategyEnabled(off, key), false, key);
    }
    // each strategy depends on its own flag only
    assert.equal(
      isGlobalStrategyEnabled({ ...off, local: { enabled: true } }, 'username'),
      false,
    );
    assert.equal(
      isGlobalStrategyEnabled(
        { ...off, local: { username_auth_enabled: true } },
        'local',
      ),
      false,
    );
  });

  it('treats missing config as disabled', () => {
    for (const key of keys) {
      assert.equal(isGlobalStrategyEnabled({}, key), false);
      assert.equal(isGlobalStrategyEnabled(undefined, key), false);
    }
  });

  it('only a strict true counts', () => {
    assert.equal(
      isGlobalStrategyEnabled({ metamask: { enabled: 'true' } }, 'metamask'),
      false,
    );
    assert.equal(
      isGlobalStrategyEnabled({ metamask: { enabled: 1 } }, 'metamask'),
      false,
    );
  });

  it('throws for an unknown strategy', () => {
    assert.throws(() => isGlobalStrategyEnabled(on, 'nope'), /Unknown strategy/);
    assert.throws(() => isGlobalStrategyEnabled(on, 'oauth'), /Unknown strategy/);
    assert.throws(
      () => isGlobalStrategyEnabled(on, 'oauth.notAProvider'),
      /Unknown strategy/,
    );
  });

  describe('oauth.<provider> (global config)', () => {
    const google = { enabled: true, clientId: 'id', clientSecret: 'secret' };

    it('is on when the provider is enabled with complete credentials', () => {
      assert.equal(isGlobalStrategyEnabled({ google }, 'oauth.google'), true);
    });

    it('is off when the provider is disabled, even with credentials', () => {
      assert.equal(
        isGlobalStrategyEnabled(
          { google: { ...google, enabled: false } },
          'oauth.google',
        ),
        false,
      );
    });

    it('is off when enabled without a client secret', () => {
      assert.equal(
        isGlobalStrategyEnabled(
          { google: { enabled: true, clientId: 'id', clientSecret: '' } },
          'oauth.google',
        ),
        false,
      );
    });

    it('is off without provider config', () => {
      assert.equal(isGlobalStrategyEnabled({}, 'oauth.google'), false);
      assert.equal(isGlobalStrategyEnabled(undefined, 'oauth.google'), false);
    });

    it('needs the private key triple for apple', () => {
      const apple = {
        enabled: true,
        clientId: 'id',
        privateKey: 'k',
        teamId: 't',
        keyId: 'x',
      };
      assert.equal(isGlobalStrategyEnabled({ apple }, 'oauth.apple'), true);
      assert.equal(
        isGlobalStrategyEnabled({ apple: { ...apple, keyId: undefined } }, 'oauth.apple'),
        false,
      );
    });
  });
});

describe('decideGuestSignIn', () => {
  const open = { directSignIn: true, strategyAtRealm: true, homeStrategyEnabled: true };

  it('admits a guest when every condition holds', () => {
    assert.deepEqual(decideGuestSignIn(open), { ok: true });
  });

  it('refuses when direct sign-in is off', () => {
    assert.deepEqual(decideGuestSignIn({ ...open, directSignIn: false }), { ok: false });
  });

  it('refuses when the strategy is off at the requested realm', () => {
    assert.deepEqual(decideGuestSignIn({ ...open, strategyAtRealm: false }), {
      ok: false,
    });
  });

  it('refuses when the strategy is off at the home realm', () => {
    assert.deepEqual(decideGuestSignIn({ ...open, homeStrategyEnabled: false }), {
      ok: false,
    });
  });

  it('refuses when the home realm is missing or inactive (null)', () => {
    assert.deepEqual(decideGuestSignIn({ ...open, homeStrategyEnabled: null }), {
      ok: false,
    });
  });
});

describe('passwordVerificationRequired', () => {
  it('uses the realm rule for a home account', () => {
    assert.equal(
      passwordVerificationRequired({
        via: 'home',
        realmRequired: false,
        homeRequired: true,
      }),
      false,
    );
    assert.equal(
      passwordVerificationRequired({
        via: 'home',
        realmRequired: true,
        homeRequired: false,
      }),
      true,
    );
  });

  it('applies the stricter of the realm and home rules to a guest', () => {
    const cases: [boolean, boolean, boolean][] = [
      [false, false, false],
      [true, false, true],
      [false, true, true],
      [true, true, true],
    ];
    for (const [realmRequired, homeRequired, expected] of cases) {
      assert.equal(
        passwordVerificationRequired({ via: 'guest', realmRequired, homeRequired }),
        expected,
        `realm=${realmRequired} home=${homeRequired}`,
      );
    }
  });
});

describe('anonymousRealmDenial', () => {
  const R = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const policies = (overrides: Record<string, unknown> = {}) => ({
    ...defaultRealmSettings().policies,
    ...overrides,
  });

  it('allows an anonymous user in a realm without restricting policies', () => {
    assert.equal(anonymousRealmDenial(R, policies(), 'web'), null);
  });

  it('refuses realms that require 2FA or a verified email', () => {
    assert.equal(
      anonymousRealmDenial(R, policies({ requireTwoFa: true }), 'web'),
      'TWO_FA_REQUIRED_FOR_REALM',
    );
    assert.equal(
      anonymousRealmDenial(R, policies({ requireVerifiedEmail: true }), 'web'),
      'REALM_ACCESS_DENIED',
    );
  });

  it('refuses clients outside allowedClientIds', () => {
    const pinned = policies({ allowedClientIds: ['web'] });
    assert.equal(anonymousRealmDenial(R, pinned, 'web'), null);
    assert.equal(anonymousRealmDenial(R, pinned, 'mobile'), 'REALM_ACCESS_DENIED');
  });
});

describe('decideGuestPrincipal', () => {
  const REALM_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const OTHER_REALM = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  const guest = { _id: 'g1', homeRealm: OTHER_REALM };

  it('resolves the single guest of the realm holding the identifier', () => {
    assert.deepEqual(
      decideGuestPrincipal({
        realmId: REALM_ID,
        directSignIn: true,
        holders: [guest],
        guestUserIds: ['g1'],
      }),
      { outcome: 'one', user: guest },
    );
  });

  it('resolves nothing when direct sign-in is off, even with a guest', () => {
    assert.deepEqual(
      decideGuestPrincipal({
        realmId: REALM_ID,
        directSignIn: false,
        holders: [guest],
        guestUserIds: ['g1'],
      }),
      { outcome: 'none' },
    );
  });

  it('resolves nothing when the holder has no guest membership in the realm', () => {
    assert.deepEqual(
      decideGuestPrincipal({
        realmId: REALM_ID,
        directSignIn: true,
        holders: [guest],
        guestUserIds: ['someone-else'],
      }),
      { outcome: 'none' },
    );
    assert.deepEqual(
      decideGuestPrincipal({
        realmId: REALM_ID,
        directSignIn: true,
        holders: [],
        guestUserIds: [],
      }),
      { outcome: 'none' },
    );
  });

  it('ignores a holder whose home realm is this realm', () => {
    const home = { _id: 'h1', homeRealm: REALM_ID };
    assert.deepEqual(
      decideGuestPrincipal({
        realmId: REALM_ID,
        directSignIn: true,
        holders: [home],
        guestUserIds: ['h1'],
      }),
      { outcome: 'none' },
    );
  });

  it('reports more than one guest as an invariant breach, without picking one', () => {
    assert.deepEqual(
      decideGuestPrincipal({
        realmId: REALM_ID,
        directSignIn: true,
        holders: [guest, { _id: 'g2', homeRealm: null }],
        guestUserIds: ['g1', 'g2'],
      }),
      { outcome: 'many', count: 2 },
    );
  });

  it('counts a global holder (no home realm) as a guest candidate', () => {
    const globalGuest = { _id: 'g3', homeRealm: null };
    assert.deepEqual(
      decideGuestPrincipal({
        realmId: REALM_ID,
        directSignIn: true,
        holders: [globalGuest],
        guestUserIds: ['g3'],
      }),
      { outcome: 'one', user: globalGuest },
    );
  });
});
