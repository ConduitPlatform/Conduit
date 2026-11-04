import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  invalidateTeamClaims,
  loadTeamClaims,
  resetTeamClaimsWarning,
  TEAM_CLAIMS_TTL_MS,
  teamClaimsKey,
} from './teamClaims.js';
import { createFakeRedis } from './fakeSession.testutil.js';

const relations = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ relation: 'member', resource: `Team:t${i}` }));

function setup(rels = relations(2)) {
  const fake = createFakeRedis();
  const requests: any[] = [];
  const warnings: string[] = [];
  const state = { fail: false };
  const deps = {
    findRelations: async (request: any) => {
      requests.push(request);
      if (state.fail) throw new Error('authorization down');
      return { relations: rels.slice(0, request.limit) };
    },
    redis: () => fake.redis,
    warn: (m: string) => warnings.push(m),
  };
  return { fake, requests, warnings, state, deps };
}

beforeEach(() => resetTeamClaimsWarning());

describe('loadTeamClaims', () => {
  it('reads direct memberships (limit 21), caches them for 60 s', async () => {
    const t = setup();
    const result = await loadTeamClaims('u1', t.deps);
    assert.deepEqual(result, {
      teams: [
        { id: 't0', role: 'member' },
        { id: 't1', role: 'member' },
      ],
      truncated: false,
    });
    assert.deepEqual(t.requests[0], {
      subject: 'User:u1',
      resourceType: 'Team',
      limit: 21,
    });
    assert.equal(teamClaimsKey('u1'), 'auth_teams_u1');
    assert.equal(t.fake.ttls.get('auth_teams_u1'), TEAM_CLAIMS_TTL_MS);
    assert.equal(TEAM_CLAIMS_TTL_MS, 60_000);
    // second call is a cache hit
    assert.deepEqual(await loadTeamClaims('u1', t.deps), result);
    assert.equal(t.requests.length, 1);
  });
  it('truncates at 20 and caches the flag', async () => {
    const t = setup(relations(30));
    const result = await loadTeamClaims('u1', t.deps);
    assert.equal(result?.teams.length, 20);
    assert.equal(result?.truncated, true);
    assert.equal((await loadTeamClaims('u1', t.deps))?.truncated, true);
  });
  it('an invalidation during the lookup prevents the stale write-back', async () => {
    const t = setup();
    const slow = {
      ...t.deps,
      findRelations: async (request: any) => {
        const response = await t.deps.findRelations(request);
        // membership changes (and is invalidated) while the lookup is in flight
        await invalidateTeamClaims(['u1'], t.fake.redis);
        return response;
      },
    };
    await loadTeamClaims('u1', slow);
    assert.equal(t.fake.store.has('auth_teams_u1'), false);
    // the next lookup caches normally
    await loadTeamClaims('u1', t.deps);
    assert.equal(t.fake.store.has('auth_teams_u1'), true);
  });
  it('invalidation drops the entry', async () => {
    const t = setup();
    await loadTeamClaims('u1', t.deps);
    await invalidateTeamClaims(['u1', 'u2'], t.fake.redis);
    assert.equal(t.fake.store.has('auth_teams_u1'), false);
    await loadTeamClaims('u1', t.deps);
    assert.equal(t.requests.length, 2);
  });
  it('without authorization: no teams, logged once, nothing cached', async () => {
    const t = setup();
    t.state.fail = true;
    assert.equal(await loadTeamClaims('u1', t.deps), undefined);
    assert.equal(await loadTeamClaims('u2', t.deps), undefined);
    assert.equal(t.warnings.length, 1);
    assert.equal(t.fake.store.size, 0);
    // recovery re-arms the warning
    t.state.fail = false;
    assert.ok(await loadTeamClaims('u1', t.deps));
    t.state.fail = true;
    await loadTeamClaims('u3', t.deps);
    assert.equal(t.warnings.length, 2);
  });
  it('a broken Redis only costs the cache', async () => {
    const t = setup();
    const broken = {
      get: async () => {
        throw new Error('down');
      },
      set: async () => {
        throw new Error('down');
      },
      del: async () => {
        throw new Error('down');
      },
    };
    const result = await loadTeamClaims('u1', { ...t.deps, redis: () => broken });
    assert.equal(result?.teams.length, 2);
    await invalidateTeamClaims(['u1'], broken);
  });
  it('an unparsable cache entry is a miss', async () => {
    const t = setup();
    t.fake.store.set('auth_teams_u1', 'not json');
    const result = await loadTeamClaims('u1', t.deps);
    assert.equal(result?.teams.length, 2);
    assert.equal(t.requests.length, 1);
  });
});
