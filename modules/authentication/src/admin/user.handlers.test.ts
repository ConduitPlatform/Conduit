import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ConduitGrpcSdk,
  getConduitCode,
  GrpcError,
  ParsedRouterRequest,
} from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { UserAdmin } from './user.js';
import { TeamsAdmin } from './team.js';
import { TokenProvider } from '../handlers/tokenProvider.js';
import { AuthUtils } from '../utils/index.js';
import { TokenType } from '../constants/index.js';
import {
  AccessToken,
  RealmMembership,
  RefreshToken,
  Team,
  Token,
  TwoFactorBackUpCodes,
  TwoFactorSecret,
  User,
} from '../models/index.js';
import { createFakeDatabase, Doc } from '../utils/fakeDatabase.testutil.js';

const { table, tables, database } = createFakeDatabase();
User.getInstance(database);
Token.getInstance(database);
AccessToken.getInstance(database);
RefreshToken.getInstance(database);
Team.getInstance(database);
RealmMembership.getInstance(database);
TwoFactorSecret.getInstance(database);
TwoFactorBackUpCodes.getInstance(database);

const flags = { email: true, authorization: true };
const published: { topic: string; payload: string }[] = [];
const relationsDeleted: { resource?: string; subject?: string }[] = [];
const emails: { template: string; params: { email?: string; variables?: Doc } }[] = [];
let relationPage: { relations: Doc[]; count: number } = { relations: [], count: 0 };
const findRelationArgs: Doc[] = [];

const authorization = {
  deleteAllRelations: async (query: { resource?: string; subject?: string }) => {
    relationsDeleted.push(query);
  },
  findRelation: async (query: Doc) => {
    findRelationArgs.push(query);
    const skip = query.skip ?? 0;
    const relations = relationPage.relations.slice(
      skip,
      skip + (query.limit ?? relationPage.relations.length),
    );
    return { relations, count: relationPage.count };
  },
};

const grpcSdk = {
  database,
  bus: {
    publish: (topic: string, payload: string) => {
      published.push({ topic, payload });
    },
  },
  // like the sdk: no client when the deployment has no authorization module
  get authorization() {
    return flags.authorization ? authorization : null;
  },
  isAvailable: (name: string) =>
    name === 'email'
      ? flags.email
      : name === 'authorization'
        ? flags.authorization
        : false,
  emailProvider: {
    sendEmail: async (template: string, params: { email?: string; variables?: Doc }) => {
      emails.push({ template, params });
    },
  },
} as unknown as ConduitGrpcSdk;

TokenProvider.getInstance(grpcSdk);
const users = new UserAdmin(grpcSdk);
const teams = new TeamsAdmin(grpcSdk);

const ID = 'a'.repeat(24);
const OTHER = 'b'.repeat(24);

function call(params: Doc = {}): ParsedRouterRequest {
  return { request: { params, bodyParams: params } } as ParsedRouterRequest;
}

function codeOf(error: unknown) {
  return error instanceof GrpcError ? error.code : undefined;
}

function conduitCodeOf(error: unknown) {
  return error instanceof GrpcError ? getConduitCode(error) : undefined;
}

function userRow(row: Doc) {
  table('User').push({
    active: true,
    isVerified: false,
    hasTwoFA: false,
    ...row,
  });
}

beforeEach(() => {
  for (const key of Object.keys(tables)) tables[key] = [];
  published.length = 0;
  relationsDeleted.length = 0;
  emails.length = 0;
  findRelationArgs.length = 0;
  relationPage = { relations: [], count: 0 };
  flags.email = true;
  flags.authorization = true;
  ConfigController.getInstance().config = {
    emailRestrictions: { enabled: false },
    teams: { enabled: false },
    local: {
      enabled: true,
      forgot_password_redirect_uri: 'https://app.example/reset',
      verification: { resend_threshold: 60_000 },
    },
    redirectUris: { allowAny: true, whitelistedUris: [] },
  };
});

describe('setPassword', () => {
  it('hashes the password, clears reset tokens and revokes sessions by default', async () => {
    userRow({ _id: ID, hashedPassword: 'old', email: 'ada@example.com' });
    table('Token').push(
      { _id: 'reset', user: ID, tokenType: TokenType.PASSWORD_RESET_TOKEN, token: 'r' },
      {
        _id: 'twofa',
        user: ID,
        tokenType: TokenType.TWO_FA_CHANGE_PASSWORD_TOKEN,
        token: 't',
      },
      { _id: 'keep', user: ID, tokenType: TokenType.VERIFICATION_TOKEN, token: 'v' },
    );
    table('AccessToken').push({ _id: 'at', user: ID, token: 'access' });
    table('RefreshToken').push({ _id: 'rt', user: ID });

    const result = await users.setPassword(call({ id: ID, password: 'correct-horse' }));
    assert.equal(result, 'Password updated');
    assert.equal(JSON.stringify(result).includes('hashedPassword'), false);
    const stored = table('User')[0];
    assert.equal(
      await AuthUtils.checkPassword('correct-horse', stored.hashedPassword),
      true,
    );
    assert.deepEqual(
      table('Token').map(row => row._id),
      ['keep'],
    );
    assert.equal(table('AccessToken').length, 0);
    assert.equal(table('RefreshToken').length, 0);
    const event = JSON.parse(published[0].payload);
    assert.equal(published[0].topic, 'authentication:update:user');
    assert.equal(event.hashedPassword, undefined);
  });

  it('keeps sessions when revokeSessions is false and refuses anonymous users, passwordless users and unknown ids', async () => {
    userRow({ _id: ID, hashedPassword: 'old' });
    table('AccessToken').push({ _id: 'at', user: ID, token: 'access' });
    await users.setPassword(
      call({ id: ID, password: 'correct-horse', revokeSessions: false }),
    );
    assert.equal(table('AccessToken').length, 1);

    userRow({ _id: OTHER, hashedPassword: 'old', isAnonymous: true });
    await assert.rejects(
      users.setPassword(call({ id: OTHER, password: 'correct-horse' })),
      error => conduitCodeOf(error) === 'ANONYMOUS_USER_NOT_ELIGIBLE',
    );
    await assert.rejects(
      users.setPassword(call({ id: 'missing', password: 'correct-horse' })),
      error => conduitCodeOf(error) === 'USER_NOT_FOUND',
    );
    userRow({ _id: 'c'.repeat(24), email: 'oauth@example.com' });
    await assert.rejects(
      users.setPassword(call({ id: 'c'.repeat(24), password: 'correct-horse' })),
      error => conduitCodeOf(error) === 'PASSWORD_AUTH_NOT_AVAILABLE',
    );
  });
});

describe('sendPasswordReset', () => {
  it('creates a reset token and emails the link without revoking sessions', async () => {
    userRow({ _id: ID, email: 'ada@example.com', hashedPassword: 'old' });
    table('AccessToken').push({ _id: 'at', user: ID, token: 'access' });
    const result = await users.sendPasswordReset(call({ id: ID }));
    assert.equal(result, 'Password reset email sent');
    assert.equal(table('Token')[0].tokenType, TokenType.PASSWORD_RESET_TOKEN);
    assert.equal(table('Token')[0].user, ID);
    assert.equal(emails[0].template, 'ForgotPassword');
    assert.match(emails[0].params.variables!.link, /reset_token=/);
    assert.equal(emails[0].params.variables!.user.hashedPassword, undefined);
    assert.equal(table('AccessToken').length, 1);
  });

  it('refuses anonymous users, users without a password and users without an email', async () => {
    userRow({
      _id: ID,
      email: 'ada@example.com',
      hashedPassword: 'old',
      isAnonymous: true,
    });
    await assert.rejects(
      users.sendPasswordReset(call({ id: ID })),
      error => codeOf(error) === status.PERMISSION_DENIED,
    );
    userRow({ _id: OTHER, email: 'oauth@example.com' });
    await assert.rejects(
      users.sendPasswordReset(call({ id: OTHER })),
      error => codeOf(error) === status.PERMISSION_DENIED,
    );
    userRow({ _id: 'c'.repeat(24), hashedPassword: 'old' });
    await assert.rejects(
      users.sendPasswordReset(call({ id: 'c'.repeat(24) })),
      error => codeOf(error) === status.FAILED_PRECONDITION,
    );
  });
});

describe('resetTwoFa', () => {
  it('removes the secret, codes and flags, publishes, and is idempotent', async () => {
    userRow({ _id: ID, hasTwoFA: true, twoFaMethod: 'authenticator' });
    table('TwoFactorSecret').push({ _id: 'sec', user: ID, secret: 's' });
    table('TwoFactorBackUpCodes').push({ _id: 'codes', user: ID, codes: ['1'] });
    table('Token').push({
      _id: 'pending',
      user: ID,
      tokenType: TokenType.AUTHENTICATOR_VERIFICATION_TOKEN,
      token: 'p',
    });
    table('AccessToken').push({ _id: 'at', user: ID });

    assert.equal(await users.resetTwoFa(call({ id: ID })), '2FA reset');
    assert.equal(table('User')[0].hasTwoFA, false);
    assert.equal(table('User')[0].twoFaMethod, null);
    assert.equal(table('TwoFactorSecret').length, 0);
    assert.equal(table('TwoFactorBackUpCodes').length, 0);
    assert.equal(table('Token').length, 0);
    assert.equal(table('AccessToken').length, 1);
    assert.deepEqual(JSON.parse(published[0].payload), { id: ID });
    assert.equal(published[0].topic, 'authentication:disableTwofa:user');

    assert.equal(await users.resetTwoFa(call({ id: ID })), '2FA reset');
    await assert.rejects(
      users.resetTwoFa(call({ id: 'missing' })),
      error => codeOf(error) === status.NOT_FOUND,
    );
  });

  it('revokes sessions only when asked', async () => {
    userRow({ _id: ID, hasTwoFA: true, twoFaMethod: 'sms' });
    table('RefreshToken').push({ _id: 'rt', user: ID });
    await users.resetTwoFa(call({ id: ID, revokeSessions: true }));
    assert.equal(table('RefreshToken').length, 0);
  });
});

describe('patchUser', () => {
  it('patches a user with no email and keeps a verify body stable', async () => {
    userRow({ _id: ID, username: 'ada' });
    const patched: any = await users.patchUser(call({ id: ID, isVerified: true }));
    assert.equal(patched.res.email, undefined);
    assert.equal(patched.res.isVerified, true);
    assert.equal(table('User')[0].twoFaMethod, undefined);

    userRow({
      _id: OTHER,
      email: 'ada@example.com',
      isVerified: false,
      hasTwoFA: true,
      twoFaMethod: 'sms',
      phoneNumber: '555-0100',
    });
    const verified: any = await users.patchUser(
      call({
        id: OTHER,
        email: 'ada@example.com',
        isVerified: true,
        hasTwoFA: true,
        phoneNumber: '555-0100',
      }),
    );
    assert.equal(verified.res.email, 'ada@example.com');
    assert.equal(verified.res.isVerified, true);
    assert.equal(verified.res.hasTwoFA, true);
    assert.equal(verified.res.twoFaMethod, 'sms');
    assert.equal(verified.res.phoneNumber, '555-0100');
  });

  it('rejects an invalid or duplicate email and clears tokens when the email changes', async () => {
    userRow({ _id: ID, email: 'ada@example.com' });
    userRow({ _id: OTHER, email: 'other@example.com' });
    table('Token').push(
      { _id: 'verify', user: ID, tokenType: TokenType.VERIFICATION_TOKEN, token: 'v' },
      { _id: 'change', user: ID, tokenType: TokenType.CHANGE_EMAIL_TOKEN, token: 'c' },
      { _id: 'reset', user: ID, tokenType: TokenType.PASSWORD_RESET_TOKEN, token: 'r' },
      { _id: 'other', user: OTHER, tokenType: TokenType.VERIFICATION_TOKEN, token: 'o' },
    );
    await assert.rejects(
      users.patchUser(call({ id: ID, email: 'nope' })),
      error => conduitCodeOf(error) === 'USER_EMAIL_INVALID',
    );
    await assert.rejects(
      users.patchUser(call({ id: ID, email: 'other@example.com' })),
      error => conduitCodeOf(error) === 'USER_EMAIL_TAKEN',
    );
    assert.equal(table('User')[0].email, 'ada@example.com');
    assert.equal(table('Token').length, 4);

    await users.patchUser(call({ id: ID, email: 'fresh@example.com' }));
    assert.equal(table('User')[0].email, 'fresh@example.com');
    assert.deepEqual(
      table('Token').map(row => row._id),
      ['other'],
    );
  });

  it('clears the phone and unsets the method when 2FA is turned off', async () => {
    userRow({
      _id: ID,
      hasTwoFA: true,
      twoFaMethod: 'sms',
      phoneNumber: '+306912345678',
    });
    await assert.rejects(
      users.patchUser(call({ id: ID, phoneNumber: '' })),
      error => codeOf(error) === status.FAILED_PRECONDITION,
    );
    assert.equal(table('User')[0].phoneNumber, '+306912345678');
    const updated: any = await users.patchUser(
      call({ id: ID, hasTwoFA: false, phoneNumber: '' }),
    );
    assert.equal(updated.res.hasTwoFA, false);
    assert.equal(updated.res.twoFaMethod, null);
    assert.equal(updated.res.phoneNumber, null);
  });
});

describe('getUsers filters', () => {
  it('does not return an active user for an id search combined with isActive false', async () => {
    userRow({ _id: ID, active: true, email: 'ada@example.com' });
    userRow({ _id: OTHER, active: false, email: 'bea@example.com' });
    const hidden: any = await users.getUsers(call({ search: ID, isActive: false }));
    assert.deepEqual(hidden.users, []);
    assert.equal(hidden.count, 0);
    const shown: any = await users.getUsers(call({ search: OTHER, isActive: false }));
    assert.equal(shown.users.length, 1);
    assert.equal(shown.users[0]._id, OTHER);
  });

  it('rejects a secret sort', async () => {
    await assert.rejects(
      users.getUsers(call({ sort: 'hashedPassword' })),
      error => codeOf(error) === status.INVALID_ARGUMENT,
    );
  });
});

describe('toggleUsers', () => {
  it('blocks by setting active false and revokes every blocked user', async () => {
    userRow({ _id: ID, active: true });
    userRow({ _id: OTHER, active: false });
    table('AccessToken').push({ _id: 'at-a', user: ID }, { _id: 'at-b', user: OTHER });
    table('RefreshToken').push({ _id: 'rt-a', user: ID }, { _id: 'rt-b', user: OTHER });
    assert.equal(
      await users.toggleUsers(call({ ids: [ID, OTHER], block: true })),
      'Users were blocked',
    );
    assert.equal(table('User').find(row => row._id === ID)!.active, false);
    assert.equal(table('User').find(row => row._id === OTHER)!.active, false);
    // OTHER was already inactive: its leftover sessions are revoked too
    assert.deepEqual(table('AccessToken'), []);
    assert.deepEqual(table('RefreshToken'), []);
    assert.equal(published[0].topic, 'authentication:block:user');
    // the event lists only the users whose status changed
    assert.deepEqual(
      JSON.parse(published[0].payload).map((row: Doc) => row._id),
      [ID],
    );
  });

  it('unblocks without touching tokens', async () => {
    userRow({ _id: ID, active: false });
    table('AccessToken').push({ _id: 'at', user: ID });
    assert.equal(
      await users.toggleUsers(call({ ids: [ID], block: false })),
      'Users were unblocked',
    );
    assert.equal(table('User')[0].active, true);
    assert.equal(table('AccessToken').length, 1);
    assert.equal(published[0].topic, 'authentication:unblock:user');
  });
});

describe('deleteUsers', () => {
  it('removes authorization relations and publishes the users', async () => {
    userRow({ _id: ID, email: 'ada@example.com' });
    userRow({ _id: OTHER, email: 'bea@example.com' });
    table('RealmMembership').push({ _id: 'm', user: ID, realm: 'realm' });
    assert.equal(
      await users.deleteUsers(call({ ids: [ID, OTHER] })),
      'Users were deleted',
    );
    assert.equal(table('User').length, 0);
    assert.equal(table('RealmMembership').length, 0);
    assert.deepEqual(relationsDeleted, [
      { resource: 'User:' + ID },
      { subject: 'User:' + ID },
      { resource: 'User:' + OTHER },
      { subject: 'User:' + OTHER },
    ]);
    const payload = JSON.parse(published[0].payload);
    assert.deepEqual(
      payload.map((row: Doc) => row._id),
      [ID, OTHER],
    );
  });
});

describe('deleteUsers without authorization', () => {
  it('deletes users and revokes sessions when there is no authorization module', async () => {
    flags.authorization = false;
    userRow({ _id: ID });
    userRow({ _id: OTHER });
    table('AccessToken').push({ _id: 'at', user: ID });
    table('RefreshToken').push({ _id: 'rt', user: OTHER });
    assert.equal(
      await users.deleteUsers(call({ ids: [ID, OTHER] })),
      'Users were deleted',
    );
    assert.equal(table('User').length, 0);
    assert.deepEqual(table('AccessToken'), []);
    assert.deepEqual(table('RefreshToken'), []);
    assert.deepEqual(relationsDeleted, []);
    userRow({ _id: ID });
    assert.equal(await users.deleteUser(call({ id: ID })), 'User was deleted');
    assert.equal(table('User').length, 0);
  });
});

describe('deleteUsers with a failing authorization module', () => {
  it('still revokes sessions, invalidates claims and publishes', async () => {
    const original = authorization.deleteAllRelations;
    authorization.deleteAllRelations = async () => {
      throw new Error('authorization down');
    };
    try {
      userRow({ _id: ID });
      userRow({ _id: OTHER });
      table('AccessToken').push({ _id: 'at', user: ID });
      assert.equal(
        await users.deleteUsers(call({ ids: [ID, OTHER] })),
        'Users were deleted',
      );
      assert.equal(table('User').length, 0);
      assert.deepEqual(table('AccessToken'), []);
      assert.equal(published[0].topic, 'authentication:delete:user');
    } finally {
      authorization.deleteAllRelations = original;
    }
  });
});

describe('getUserTeams', () => {
  it('groups roles, pages and counts teams and 404s an unknown user', async () => {
    userRow({ _id: ID });
    table('Team').push(
      { _id: 'team-1', name: 'Alpha', isDefault: false, parentTeam: 'parent' },
      { _id: 'team-2', name: 'Beta', isDefault: true },
      { _id: 'team-3', name: 'Gamma', isDefault: false },
    );
    relationPage = {
      count: 4,
      relations: [
        { resource: 'Team:team-1', relation: 'member' },
        { resource: 'Team:team-1', relation: 'owner' },
        { resource: 'Team:team-2', relation: 'readAll' },
        { resource: 'Team:team-3', relation: 'member' },
      ],
    };
    const first: any = await teams.getUserTeams(call({ id: ID, limit: 2 }));
    assert.equal(findRelationArgs[0].subject, 'User:' + ID);
    assert.equal(findRelationArgs[0].resourceType, 'Team');
    // the count is teams, not relations
    assert.equal(first.count, 3);
    assert.deepEqual(first.teams, [
      {
        _id: 'team-1',
        name: 'Alpha',
        isDefault: false,
        parentTeam: 'parent',
        roles: ['member', 'owner'],
      },
      { _id: 'team-2', name: 'Beta', isDefault: true, roles: ['readAll'] },
    ]);
    const second: any = await teams.getUserTeams(call({ id: ID, skip: 2, limit: 2 }));
    assert.equal(second.count, 3);
    assert.deepEqual(
      second.teams.map((team: Doc) => team._id),
      ['team-3'],
    );

    // search filters before paging and the count follows it
    const searched: any = await teams.getUserTeams(call({ id: ID, search: 'gam' }));
    assert.equal(searched.count, 1);
    assert.equal(searched.teams[0]._id, 'team-3');

    relationPage = { relations: [], count: 0 };
    const empty: any = await teams.getUserTeams(call({ id: ID }));
    assert.deepEqual(empty, { teams: [], count: 0 });
    await assert.rejects(
      teams.getUserTeams(call({ id: 'missing' })),
      error => codeOf(error) === status.NOT_FOUND,
    );
  });

  it('reads relations past the first authorization page', async () => {
    userRow({ _id: ID });
    const relations = Array.from({ length: 501 }, (_, index) => ({
      resource: `Team:team-${index}`,
      relation: 'member',
    }));
    table('Team').push(
      ...relations.map((_, index) => ({
        _id: `team-${index}`,
        name: `T${String(index).padStart(3, '0')}`,
      })),
    );
    relationPage = { relations, count: relations.length };
    const result: any = await teams.getUserTeams(call({ id: ID, skip: 500 }));
    assert.equal(findRelationArgs.length, 2);
    assert.equal(findRelationArgs[1].skip, 500);
    assert.equal(result.count, 501);
    assert.deepEqual(
      result.teams.map((team: Doc) => team._id),
      ['team-500'],
    );
  });

  it('adds the realm membership type', async () => {
    ConfigController.getInstance().config = {
      ...ConfigController.getInstance().config,
      teams: { enabled: true, realms: { enabled: true } },
    };
    userRow({ _id: ID });
    table('Team').push({
      _id: 'realm-1',
      name: 'Realm',
      isDefault: false,
      realm: { enabled: true, slug: 'realm' },
    });
    table('RealmMembership').push({
      _id: 'mem',
      user: ID,
      realm: 'realm-1',
      membershipType: 'guest',
    });
    relationPage = {
      count: 1,
      relations: [{ resource: 'Team:realm-1', relation: 'member' }],
    };
    const result: any = await teams.getUserTeams(call({ id: ID }));
    assert.equal(result.teams[0].membershipType, 'guest');
    assert.deepEqual(result.teams[0].realm, { enabled: true, slug: 'realm' });
  });
});

describe('getUser', () => {
  it('returns a user by any id format, 404s a missing one and answers capabilities', async () => {
    const uuid = '3f2c1d4e-8a7b-4c6d-9e0f-1a2b3c4d5e6f';
    userRow({ _id: uuid, email: 'ada@example.com' });
    const found: any = await users.getUser(call({ id: uuid }));
    assert.equal(found._id, uuid);
    assert.equal(found.email, 'ada@example.com');
    await assert.rejects(
      users.getUser(call({ id: 'missing' })),
      error => codeOf(error) === status.NOT_FOUND,
    );
    const capabilities: any = await users.getUser(call({ id: 'capabilities' }));
    assert.equal(capabilities.version, 1);
    assert.equal(capabilities.actions.includes('getUserById'), true);
  });
});

describe('getUserCapabilities', () => {
  it('follows the email module and teams', async () => {
    flags.email = false;
    flags.authorization = false;
    const legacy = (await users.getUserCapabilities()) as { actions: string[] };
    assert.equal(legacy.actions.includes('sendPasswordReset'), false);
    assert.equal(legacy.actions.includes('userTeams'), false);
    flags.email = true;
    ConfigController.getInstance().config = {
      teams: { enabled: true },
    };
    flags.authorization = true;
    // email came up after the admin routes were registered: no route, not advertised
    users.passwordResetRouteRegistered = false;
    const pending = (await users.getUserCapabilities()) as { actions: string[] };
    assert.equal(pending.actions.includes('sendPasswordReset'), false);
    users.passwordResetRouteRegistered = true;
    const full = (await users.getUserCapabilities()) as { actions: string[] };
    assert.equal(full.actions.includes('sendPasswordReset'), true);
    assert.equal(full.actions.includes('userTeams'), true);
    users.passwordResetRouteRegistered = false;
  });
});
