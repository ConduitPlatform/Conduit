import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { matches } from '../utils/fakeDatabase.testutil.js';
import { withHomeScope } from '../utils/realm.logic.js';
import {
  OAUTH_PROVIDER_KEYS,
  assertSortAllowed,
  buildUserAdminCapabilities,
  buildUserPatch,
  groupUserTeamRelations,
  userFilterQuery,
  UserPatchSource,
} from './user.logic.js';

const ID = 'a'.repeat(24);
const OTHER = 'b'.repeat(24);

function codeOf(error: unknown) {
  return error instanceof GrpcError ? error.code : undefined;
}

const baseUser: UserPatchSource = {
  email: 'ada@example.com',
  isVerified: false,
  hasTwoFA: false,
  phoneNumber: '+306912345678',
  twoFaMethod: 'sms',
};

beforeEach(() => {
  ConfigController.getInstance().config = {
    emailRestrictions: { enabled: false },
    teams: { enabled: false },
  };
});

describe('userFilterQuery', () => {
  it('applies isVerified and hasTwoFA', () => {
    const query = userFilterQuery({ isVerified: true, hasTwoFA: false });
    assert.equal(query.isVerified, true);
    assert.equal(query.hasTwoFA, false);
  });

  it('matches a missing isAnonymous field when the filter is false', () => {
    const query = userFilterQuery({ isAnonymous: false });
    // no `$ne: true`: on SQL it would drop NULL rows
    assert.equal('isAnonymous' in query, false);
    assert.deepEqual(query.$and, [
      {
        $or: [
          { isAnonymous: false },
          { isAnonymous: null },
          { isAnonymous: { $exists: false } },
        ],
      },
    ]);
    assert.equal(matches({ email: 'ada@example.com' }, query), true);
    assert.equal(matches({ isAnonymous: null }, query), true);
    assert.equal(matches({ isAnonymous: false }, query), true);
    assert.equal(matches({ isAnonymous: true }, query), false);
    // the homeRealm scope is appended to the same $and
    const scoped = userFilterQuery({ isAnonymous: false, homeRealm: 'global' });
    assert.equal(scoped.$and.length, 2);
    assert.equal(matches({ isAnonymous: null, homeRealm: null }, scoped), true);
    assert.equal(matches({ isAnonymous: true, homeRealm: null }, scoped), false);
    assert.equal(userFilterQuery({ isAnonymous: true }).isAnonymous, true);
  });

  it('maps each provider and rejects an unknown one', () => {
    assert.deepEqual(userFilterQuery({ provider: 'local' }).hashedPassword, {
      $exists: true,
      $ne: null,
    });
    assert.deepEqual(userFilterQuery({ provider: 'phone' }), {
      phoneNumber: { $exists: true, $ne: null },
      hashedPassword: null,
    });
    const phone = userFilterQuery({ provider: 'phone' });
    assert.equal(matches({ phoneNumber: '+30691', hashedPassword: null }, phone), true);
    assert.equal(matches({ phoneNumber: '+30691' }, phone), true);
    assert.equal(matches({ phoneNumber: '+30691', hashedPassword: 'h' }, phone), false);
    assert.deepEqual(userFilterQuery({ provider: 'username' }).username, {
      $exists: true,
      $ne: null,
    });
    assert.deepEqual(userFilterQuery({ provider: 'metamask' }).metamask, {
      $exists: true,
      $ne: null,
    });
    for (const provider of OAUTH_PROVIDER_KEYS) {
      assert.deepEqual(userFilterQuery({ provider })[provider], {
        $exists: true,
        $ne: null,
      });
    }
    assert.throws(
      () => userFilterQuery({ provider: 'hashedPassword' }),
      error => codeOf(error) === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () => userFilterQuery({ provider: 'customField' }),
      error => codeOf(error) === status.INVALID_ARGUMENT,
    );
  });

  it('keeps other filters when the search is an id', () => {
    const query = userFilterQuery({
      search: ID,
      isActive: false,
      isVerified: true,
    });
    assert.equal(query._id, ID);
    assert.equal(query.active, false);
    assert.equal(query.isVerified, true);
  });

  it('keeps the homeRealm global scope', () => {
    assert.deepEqual(
      userFilterQuery({ homeRealm: 'global', isActive: true }),
      withHomeScope({ active: true }, null),
    );
    assert.deepEqual(
      userFilterQuery({ homeRealm: OTHER, isVerified: false }),
      withHomeScope({ isVerified: false }, OTHER),
    );
  });
});

describe('assertSortAllowed', () => {
  it('allows a descending createdAt and rejects secret fields', () => {
    assert.doesNotThrow(() => assertSortAllowed('-createdAt'));
    assert.doesNotThrow(() => assertSortAllowed('email'));
    assert.doesNotThrow(() => assertSortAllowed('customField'));
    assert.doesNotThrow(() => assertSortAllowed(undefined));
    for (const sort of [
      'hashedPassword',
      '-hashedPassword',
      'google.token',
      'metamask.nonce',
    ]) {
      assert.throws(
        () => assertSortAllowed(sort),
        error => codeOf(error) === status.INVALID_ARGUMENT,
      );
    }
  });
});

describe('buildUserPatch', () => {
  it('leaves the email alone when it is omitted', () => {
    const { update, emailChanged } = buildUserPatch(
      { ...baseUser, email: undefined },
      { isVerified: true },
    );
    assert.equal(emailChanged, false);
    assert.equal('email' in update, false);
    assert.equal(update.isVerified, true);
    assert.equal('twoFaMethod' in update, false);
  });

  it('rejects an invalid email and a new invalid phone', () => {
    assert.throws(
      () => buildUserPatch(baseUser, { email: 'not-an-email' }),
      error => codeOf(error) === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () => buildUserPatch(baseUser, { phoneNumber: '12345' }),
      error => codeOf(error) === status.INVALID_ARGUMENT,
    );
  });

  it('accepts the stored phone even when it is not E.164 and clears with an empty string', () => {
    const legacy = { ...baseUser, phoneNumber: '555-0100' };
    const same = buildUserPatch(legacy, { phoneNumber: '555-0100' });
    assert.equal('phoneNumber' in same.update, false);
    const cleared = buildUserPatch(
      { ...baseUser, hasTwoFA: false, twoFaMethod: 'authenticator' },
      { phoneNumber: '' },
    );
    assert.equal(cleared.update.phoneNumber, null);
  });

  it('refuses to clear the phone while SMS 2FA stays on', () => {
    assert.throws(
      () => buildUserPatch({ ...baseUser, hasTwoFA: true }, { phoneNumber: '' }),
      error => codeOf(error) === status.FAILED_PRECONDITION,
    );
    assert.throws(
      () =>
        buildUserPatch(
          { ...baseUser, phoneNumber: null, hasTwoFA: false },
          { hasTwoFA: true },
        ),
      error => codeOf(error) === status.INVALID_ARGUMENT,
    );
  });

  it('keeps twoFaMethod when hasTwoFA is omitted and unsets it when false', () => {
    const kept = buildUserPatch(baseUser, { isVerified: true });
    assert.equal('twoFaMethod' in kept.update, false);
    assert.equal('hasTwoFA' in kept.update, false);
    const off = buildUserPatch(baseUser, { hasTwoFA: false });
    assert.equal(off.update.hasTwoFA, false);
    assert.equal(off.update.twoFaMethod, null);
  });

  it('keeps the verify-only body behaviour', () => {
    const verified = buildUserPatch(baseUser, {
      email: 'Ada@example.com',
      isVerified: true,
      hasTwoFA: true,
      phoneNumber: '+306912345678',
    });
    assert.equal(verified.emailChanged, false);
    assert.equal(verified.update.email, undefined);
    assert.equal(verified.update.isVerified, true);
    assert.equal(verified.update.hasTwoFA, true);
    assert.equal(verified.update.twoFaMethod, 'sms');
    assert.equal('phoneNumber' in verified.update, false);
  });

  it('rejects authenticator without a secret and accepts it with one', () => {
    const on = { ...baseUser, hasTwoFA: true };
    assert.throws(
      () => buildUserPatch(on, { twoFaMethod: 'authenticator' }),
      error => codeOf(error) === status.INVALID_ARGUMENT,
    );
    const ok = buildUserPatch(
      baseUser,
      { twoFaMethod: 'authenticator', hasTwoFA: true },
      { authenticatorSecret: true },
    );
    assert.equal(ok.update.twoFaMethod, 'authenticator');
  });

  it('switches to sms and rejects an unknown method', () => {
    const sms = buildUserPatch(
      { ...baseUser, hasTwoFA: true, twoFaMethod: 'authenticator' },
      { hasTwoFA: true, twoFaMethod: 'sms' },
    );
    assert.equal(sms.update.twoFaMethod, 'sms');
    assert.throws(
      () =>
        buildUserPatch(
          {
            ...baseUser,
            hasTwoFA: true,
            twoFaMethod: 'authenticator',
            phoneNumber: null,
          },
          { twoFaMethod: 'sms' },
        ),
      error => codeOf(error) === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () =>
        buildUserPatch({ ...baseUser, hasTwoFA: true }, { twoFaMethod: 'authenticatr' }),
      error => codeOf(error) === status.INVALID_ARGUMENT,
    );
  });

  it('accepts stored spellings of the method and ignores it when 2FA is turned off', () => {
    const on = { ...baseUser, hasTwoFA: true };
    assert.equal(buildUserPatch(on, { twoFaMethod: 'phone' }).update.twoFaMethod, 'sms');
    assert.deepEqual(buildUserPatch(on, { twoFaMethod: '' }).update, {});
    for (const twoFaMethod of ['', 'phone', 'authenticator', 'bogus']) {
      const off = buildUserPatch(on, { hasTwoFA: false, twoFaMethod });
      assert.equal(off.update.twoFaMethod, null);
      assert.equal(off.update.hasTwoFA, false);
    }
  });

  it('refuses a method while 2FA stays off', () => {
    assert.throws(
      () => buildUserPatch(baseUser, { twoFaMethod: 'sms' }),
      error => codeOf(error) === status.FAILED_PRECONDITION,
    );
  });

  it('lets an unrelated or unchanged edit through for a user with SMS 2FA and no phone', () => {
    const legacy = { ...baseUser, hasTwoFA: true, twoFaMethod: null, phoneNumber: null };
    const verified = buildUserPatch(legacy, { isVerified: true });
    assert.deepEqual(verified.update, { isVerified: true });
    // a client resending the unchanged 2FA state with an email edit
    const resent = buildUserPatch(legacy, {
      email: 'new@example.com',
      hasTwoFA: true,
      twoFaMethod: 'sms',
    });
    assert.equal(resent.update.email, 'new@example.com');
    assert.equal(
      'twoFaMethod' in buildUserPatch(legacy, { hasTwoFA: true }).update,
      false,
    );
    // a real change is still checked
    assert.throws(
      () => buildUserPatch({ ...legacy, hasTwoFA: false }, { hasTwoFA: true }),
      error => codeOf(error) === status.INVALID_ARGUMENT,
    );
  });

  it('marks a changed email', () => {
    const changed = buildUserPatch(baseUser, { email: ' New@Example.com ' });
    assert.equal(changed.emailChanged, true);
    assert.equal(changed.update.email, 'new@example.com');
  });
});

describe('buildUserAdminCapabilities', () => {
  it('includes the reset email only when email is available and teams only when enabled', () => {
    assert.deepEqual(
      buildUserAdminCapabilities({ emailAvailable: true, teamsEnabled: true }).actions,
      [
        'setPassword',
        'sendPasswordReset',
        'resetTwoFa',
        'clearPhone',
        'bulkDeleteFull',
        'bulkToggleFixed',
        'userTeams',
      ],
    );
    const neither = buildUserAdminCapabilities({
      emailAvailable: false,
      teamsEnabled: false,
    });
    assert.equal(neither.version, 1);
    assert.deepEqual(neither.filters, [
      'isVerified',
      'hasTwoFA',
      'isAnonymousExclusive',
      'providerPhone',
    ]);
    assert.deepEqual(neither.sort, [
      'email',
      'createdAt',
      'updatedAt',
      'active',
      'isVerified',
    ]);
    assert.equal(neither.actions.includes('sendPasswordReset'), false);
    assert.equal(neither.actions.includes('userTeams'), false);
  });
});

describe('groupUserTeamRelations', () => {
  it('groups roles per team', () => {
    assert.deepEqual(
      groupUserTeamRelations([
        { resource: 'Team:t1', relation: 'member' },
        { resource: 'Team:t1', relation: 'owner' },
        { resource: 'Team:t1', relation: 'member' },
        { resource: 'Team:t2', relation: 'readAll' },
      ]),
      [
        { teamId: 't1', roles: ['member', 'owner'] },
        { teamId: 't2', roles: ['readAll'] },
      ],
    );
  });
});
