import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { buildEffectiveSettings, defaultRealmSettings } from '../utils/realm.logic.js';
import {
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
      $or: [{ homeRealm: null }, { homeRealm: { $exists: false } }],
    });
  });

  it('scopes to a realm', () => {
    assert.deepEqual(scopeUserQuery({ username: 'bob' }, 'r1', true), {
      username: 'bob',
      homeRealm: 'r1',
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

  it('rejects a mismatch', () => {
    assert.throws(() => reconcileInvitationRealm('r1', 'r2', true), invalid);
    assert.throws(() => reconcileInvitationRealm('r1', null, true), invalid);
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
