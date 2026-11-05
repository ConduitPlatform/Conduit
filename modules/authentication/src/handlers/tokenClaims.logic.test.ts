import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAccessTokenClaims,
  BuildAccessTokenClaimsInput,
  MAX_TEAM_CLAIMS,
  resolveRealmType,
  teamClaimsFromRelations,
} from './tokenClaims.logic.js';

const NOW = 1_700_000_000_000;

function input(overrides: Partial<BuildAccessTokenClaimsInput> = {}) {
  return {
    userId: 'u1',
    sessionId: 'sid1',
    clientId: 'web',
    authorized: true,
    sudo: false,
    tokenVersion: 3,
    now: NOW,
    expiryMs: 120_000,
    ...overrides,
  } satisfies BuildAccessTokenClaimsInput;
}

const rel = (n: number, relation = 'member') => ({
  relation,
  resource: `Team:t${n}`,
});

describe('buildAccessTokenClaims', () => {
  it('a global session carries exactly the base claims', () => {
    assert.deepEqual(buildAccessTokenClaims(input()), {
      sub: 'u1',
      sid: 'sid1',
      cid: 'web',
      authorized: true,
      sudo: false,
      tv: 3,
      iat: NOW / 1000,
      exp: NOW / 1000 + 120,
      iss: 'conduit',
    });
  });
  it('a realm session adds rid, realm, home, rtype and the teams', () => {
    const claims = buildAccessTokenClaims(
      input({
        realmId: 'r1',
        realmSlug: 'acme',
        homeSlug: 'acme',
        homeRealm: 'r1',
        sudo: true,
        teams: { teams: [{ id: 't1', role: 'owner' }], truncated: false },
      }),
    );
    assert.deepEqual(claims, {
      sub: 'u1',
      sid: 'sid1',
      cid: 'web',
      rid: 'r1',
      realm: 'acme',
      home: 'acme',
      rtype: 'home',
      authorized: true,
      sudo: true,
      tv: 3,
      teams: [{ id: 't1', role: 'owner' }],
      iat: NOW / 1000,
      exp: NOW / 1000 + 120,
      iss: 'conduit',
    });
  });
  it('flags a truncated team list and leaves teams out when unavailable', () => {
    const truncated = buildAccessTokenClaims(
      input({ teams: { teams: [{ id: 't1', role: 'member' }], truncated: true } }),
    );
    assert.equal(truncated.teamsTruncated, true);
    const none = buildAccessTokenClaims(input());
    assert.equal('teams' in none, false);
    assert.equal('teamsTruncated' in none, false);
    const empty = buildAccessTokenClaims(
      input({ teams: { teams: [], truncated: false } }),
    );
    assert.deepEqual(empty.teams, []);
    assert.equal('teamsTruncated' in empty, false);
  });
  it('a 2FA-pending token is unauthorized', () => {
    assert.equal(buildAccessTokenClaims(input({ authorized: false })).authorized, false);
  });
  it('exp follows the expiry period', () => {
    const claims = buildAccessTokenClaims(input({ expiryMs: 300_000 }));
    assert.equal(claims.exp - claims.iat, 300);
  });
});

describe('resolveRealmType', () => {
  it('home when the realm is the home realm', () => {
    assert.equal(resolveRealmType({ realmId: 'r1', homeRealm: 'r1' }), 'home');
    // home wins over a (stale) guest membership
    assert.equal(
      resolveRealmType({ realmId: 'r1', homeRealm: 'r1', hasGuestMembership: true }),
      'home',
    );
  });
  it('guest for another realm with a guest membership', () => {
    assert.equal(
      resolveRealmType({ realmId: 'r2', homeRealm: 'r1', hasGuestMembership: true }),
      'guest',
    );
    assert.equal(
      resolveRealmType({ realmId: 'r2', homeRealm: null, hasGuestMembership: true }),
      'guest',
    );
  });
  it('global sessions and unresolvable relations carry no type', () => {
    assert.equal(resolveRealmType({ realmId: null, homeRealm: 'r1' }), undefined);
    assert.equal(
      resolveRealmType({ homeRealm: 'r1', hasGuestMembership: true }),
      undefined,
    );
    assert.equal(resolveRealmType({ realmId: 'r2', homeRealm: 'r1' }), undefined);
  });
});

describe('teamClaimsFromRelations', () => {
  it('maps relations to { id, role }', () => {
    assert.deepEqual(teamClaimsFromRelations([rel(1, 'owner'), rel(2)]), {
      teams: [
        { id: 't1', role: 'owner' },
        { id: 't2', role: 'member' },
      ],
      truncated: false,
    });
  });
  it('exactly the cap is not truncated', () => {
    const result = teamClaimsFromRelations(
      Array.from({ length: MAX_TEAM_CLAIMS }, (_, i) => rel(i)),
    );
    assert.equal(result.teams.length, 20);
    assert.equal(result.truncated, false);
  });
  it('one more than the cap is cut to 20 and flagged', () => {
    const result = teamClaimsFromRelations(
      Array.from({ length: MAX_TEAM_CLAIMS + 1 }, (_, i) => rel(i)),
    );
    assert.equal(result.teams.length, 20);
    assert.equal(result.truncated, true);
    assert.deepEqual(
      result.teams.map(team => team.id),
      [...result.teams.map(team => team.id)].sort(),
    );
  });
  it('keeps the same 20 whatever order the relations arrive in', () => {
    const all = Array.from({ length: MAX_TEAM_CLAIMS + 1 }, (_, i) => rel(i));
    const shuffled = [...all.slice(7), ...all.slice(0, 7)].reverse();
    assert.deepEqual(teamClaimsFromRelations(shuffled), teamClaimsFromRelations(all));
  });
  it('ignores non-team resources and duplicate teams', () => {
    const result = teamClaimsFromRelations([
      { relation: 'viewer', resource: 'Folder:f1' },
      rel(1, 'owner'),
      rel(1, 'member'),
      { relation: 'member', resource: 'Team:' },
    ]);
    assert.deepEqual(result, { teams: [{ id: 't1', role: 'owner' }], truncated: false });
  });
});
