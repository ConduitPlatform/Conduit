import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { buildEffectiveSettings, defaultRealmSettings } from '../utils/realm.logic.js';
import {
  isGlobalStrategyEnabled,
  isHomeRealm,
  isInviteRequired,
  isStrategyEnabled,
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
    assert.throws(() => isGlobalStrategyEnabled(on, 'oauth.google'), /Unknown strategy/);
  });
});
