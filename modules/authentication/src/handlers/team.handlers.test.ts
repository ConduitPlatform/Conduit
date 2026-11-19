import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { TeamsHandler } from './team.js';
import { Team, Token, User } from '../models/index.js';
import { createFakeDatabase } from '../utils/fakeDatabase.testutil.js';

const { table, tables, database } = createFakeDatabase();
Team.getInstance(database);
Token.getInstance(database);
User.getInstance(database);

type Rel = { subject: string; resource: string; relation: string };

// Authorization client stub: `can` answers from `allowed`, relations live in `relations`.
function setAuthorization(grpcSdk: { authorization?: unknown }, allowed: string[]) {
  const relations: Rel[] = [];
  const state = { allowed: new Set(allowed), relations };
  grpcSdk.authorization = {
    can: async ({ actions }: { actions: string[] }) => ({
      allow: actions.every(action => state.allowed.has(action)),
    }),
    findRelation: async (q: {
      subject?: string;
      resource?: string;
      relation?: string;
    }) => {
      const found = relations.filter(
        r =>
          (!q.subject || r.subject === q.subject) &&
          (!q.resource || r.resource === q.resource) &&
          (!q.relation || r.relation === q.relation),
      );
      return {
        relations: found.map(r => ({ ...r })),
        count: found.length,
      };
    },
    deleteAllRelations: async ({
      subject,
      resource,
    }: {
      subject: string;
      resource: string;
    }) => {
      for (let i = relations.length - 1; i >= 0; i--) {
        if (relations[i].subject === subject && relations[i].resource === resource) {
          relations.splice(i, 1);
        }
      }
    },
    createRelation: async ({
      subject,
      resource,
      relation,
    }: {
      subject: string;
      resource: string;
      relation: string;
    }) => {
      relations.push({ subject, resource, relation });
    },
  };
  return state;
}

const TEAM = 'team1';

// the fake database matches dotted query paths against flat keys
function invitation(token: string) {
  return { _id: 'tok-' + token, token, data: { teamId: TEAM }, 'data.teamId': TEAM };
}
const resource = 'Team:' + TEAM;

const grpcSdk = { database } as unknown as ConduitGrpcSdk & { authorization?: unknown };
const handler = TeamsHandler.getInstance(grpcSdk);

function request(userId: string, params: Record<string, unknown>) {
  return {
    request: {
      context: { user: { _id: userId, name: userId } },
      params,
      urlParams: {},
      queryParams: {},
    },
  } as any;
}

beforeEach(() => {
  for (const name of Object.keys(tables)) {
    tables[name].length = 0;
  }
  ConfigController.getInstance().config = {
    teams: {
      invites: { enabled: true, sendEmail: false, inviteUrl: 'http://invite' },
      allowAddWithoutInvite: true,
    },
  };
  table('Team').push({ _id: TEAM, name: 'Team 1', isDefault: false });
  table('User').push(
    { _id: 'owner', active: true },
    { _id: 'editor', active: true },
    { _id: 'target', active: true },
  );
});

describe('persistentInvite', () => {
  it('rejects a caller who is not an owner of the team', async () => {
    const authz = setAuthorization(grpcSdk, []);
    authz.relations.push({ subject: 'User:editor', resource, relation: 'member' });
    await assert.rejects(
      handler.persistentInvite(request('editor', { teamId: TEAM, role: 'member' })),
      { conduitCode: 'TEAM_PERMISSION_DENIED' },
    );
    assert.equal(table('Token').length, 0);
  });

  it('creates an invitation for an owner', async () => {
    const authz = setAuthorization(grpcSdk, []);
    authz.relations.push({ subject: 'User:owner', resource, relation: 'owner' });
    const token = await handler.persistentInvite(
      request('owner', { teamId: TEAM, role: 'member' }),
    );
    assert.equal(typeof token, 'string');
    assert.equal(table('Token').length, 1);
  });

  it('rejects a role that is not a team relation', async () => {
    const authz = setAuthorization(grpcSdk, []);
    authz.relations.push({ subject: 'User:owner', resource, relation: 'owner' });
    await assert.rejects(
      handler.persistentInvite(request('owner', { teamId: TEAM, role: 'superuser' })),
      { conduitCode: 'REQUEST_INVALID' },
    );
  });
});

describe('deletePersistentInvitation', () => {
  it('rejects a caller who is not an owner of the team', async () => {
    const authz = setAuthorization(grpcSdk, []);
    authz.relations.push({ subject: 'User:editor', resource, relation: 'member' });
    table('Token').push(invitation('tok'));
    await assert.rejects(
      handler.deletePersistentInvitation(
        request('editor', { teamId: TEAM, invitationToken: 'tok' }),
      ),
      { conduitCode: 'TEAM_PERMISSION_DENIED' },
    );
    assert.equal(table('Token').length, 1);
  });

  it('deletes the invitation for an owner', async () => {
    const authz = setAuthorization(grpcSdk, []);
    authz.relations.push({ subject: 'User:owner', resource, relation: 'owner' });
    table('Token').push(invitation('tok'));
    const result = await handler.deletePersistentInvitation(
      request('owner', { teamId: TEAM, invitationToken: 'tok' }),
    );
    assert.equal(result, 'Invitation token deleted');
    assert.equal(table('Token').length, 0);
  });
});

describe('userInvite role checks', () => {
  it('rejects granting the owner role to a caller who can invite but is not an owner', async () => {
    setAuthorization(grpcSdk, ['invite']);
    await assert.rejects(
      handler.userInvite(request('editor', { teamId: TEAM, role: 'owner' })),
      { conduitCode: 'TEAM_PERMISSION_DENIED' },
    );
    assert.equal(table('Token').length, 0);
  });

  it('lets a direct owner grant the owner role', async () => {
    const authz = setAuthorization(grpcSdk, ['invite']);
    authz.relations.push({ subject: 'User:owner', resource, relation: 'owner' });
    const token = await handler.userInvite(
      request('owner', { teamId: TEAM, role: 'owner' }),
    );
    assert.equal(typeof token, 'string');
    assert.equal(table('Token')[0].data.role, 'owner');
  });

  it('lets an invite-permitted non-owner invite with a non-owner role', async () => {
    setAuthorization(grpcSdk, ['invite']);
    const token = await handler.userInvite(
      request('editor', { teamId: TEAM, role: 'readAll' }),
    );
    assert.equal(typeof token, 'string');
    assert.equal(table('Token')[0].data.role, 'readAll');
  });

  it('rejects a role outside the team relations', async () => {
    const authz = setAuthorization(grpcSdk, ['invite']);
    authz.relations.push({ subject: 'User:owner', resource, relation: 'owner' });
    await assert.rejects(
      handler.userInvite(request('owner', { teamId: TEAM, role: 'admin' })),
      { conduitCode: 'REQUEST_INVALID' },
    );
  });
});

describe('modifyMembersRoles', () => {
  it('rejects granting the owner role to a non-owner editor, and writes nothing', async () => {
    const authz = setAuthorization(grpcSdk, ['edit']);
    authz.relations.push({ subject: 'User:target', resource, relation: 'member' });
    await assert.rejects(
      handler.modifyMembersRoles(
        request('editor', { teamId: TEAM, members: ['target'], role: 'owner' }),
      ),
      { conduitCode: 'TEAM_PERMISSION_DENIED' },
    );
    assert.deepEqual(
      authz.relations.map(r => r.relation),
      ['member'],
    );
  });

  it('rejects changing an existing owner without deleteOwners, and writes nothing', async () => {
    const authz = setAuthorization(grpcSdk, ['edit']);
    authz.relations.push({ subject: 'User:target', resource, relation: 'owner' });
    await assert.rejects(
      handler.modifyMembersRoles(
        request('editor', { teamId: TEAM, members: ['target'], role: 'member' }),
      ),
      { conduitCode: 'TEAM_PERMISSION_DENIED' },
    );
    assert.deepEqual(
      authz.relations.map(r => r.relation),
      ['owner'],
    );
  });

  it('lets an owner with deleteOwners change an existing owner', async () => {
    const authz = setAuthorization(grpcSdk, ['edit', 'deleteOwners']);
    authz.relations.push({ subject: 'User:owner', resource, relation: 'owner' });
    authz.relations.push({ subject: 'User:target', resource, relation: 'owner' });
    await handler.modifyMembersRoles(
      request('owner', { teamId: TEAM, members: ['target'], role: 'member' }),
    );
    assert.deepEqual(
      authz.relations.filter(r => r.subject === 'User:target').map(r => r.relation),
      ['member'],
    );
  });

  it('lets an owner grant a member the owner role', async () => {
    const authz = setAuthorization(grpcSdk, ['edit']);
    authz.relations.push({ subject: 'User:owner', resource, relation: 'owner' });
    authz.relations.push({ subject: 'User:target', resource, relation: 'member' });
    await handler.modifyMembersRoles(
      request('owner', { teamId: TEAM, members: ['target'], role: 'owner' }),
    );
    assert.deepEqual(
      authz.relations.filter(r => r.subject === 'User:target').map(r => r.relation),
      ['owner'],
    );
  });

  it('rejects a role outside the team relations', async () => {
    const authz = setAuthorization(grpcSdk, ['edit']);
    authz.relations.push({ subject: 'User:owner', resource, relation: 'owner' });
    await assert.rejects(
      handler.modifyMembersRoles(
        request('owner', { teamId: TEAM, members: ['target'], role: 'root' }),
      ),
      { conduitCode: 'REQUEST_INVALID' },
    );
  });
});
