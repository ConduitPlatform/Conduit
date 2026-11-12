import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk, getConduitCode, GrpcError } from '@conduitplatform/grpc-sdk';
import { authErrors } from '@conduitplatform/module-tools';
import { ConfigController, verifyAccessToken } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import jwt from 'jsonwebtoken';
import { TokenProvider } from './tokenProvider.js';
import { AccessToken, RealmMembership, RefreshToken, User } from '../models/index.js';
import { createFakeDatabase } from '../utils/fakeDatabase.testutil.js';
import { createFakeRedis, createFakeRegistry } from '../utils/fakeSession.testutil.js';
import { configureSessionServices } from '../utils/sessionServices.js';
import { resetTeamClaimsWarning } from '../utils/teamClaims.js';
import { generateSigningKeypair } from '../utils/signingKeys.logic.js';
import { hashRefreshToken } from '../utils/refreshToken.logic.js';

const { table, tables, database } = createFakeDatabase();
AccessToken.getInstance(database);
RefreshToken.getInstance(database);
RealmMembership.getInstance(database);
User.getInstance(database);

const relationsByUser: Record<string, { relation: string; resource: string }[]> = {};
const findRelationCalls: any[] = [];
let authorizationUp = true;
const grpcSdk = {
  database,
  isAvailable: () => authorizationUp,
  authorization: {
    findRelation: async (request: any) => {
      findRelationCalls.push(request);
      const all = relationsByUser[request.subject.replace('User:', '')] ?? [];
      return { relations: all.slice(0, request.limit), count: all.length };
    },
  },
} as unknown as ConduitGrpcSdk;
const provider = TokenProvider.getInstance(grpcSdk);

const keys = generateSigningKeypair();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ACCESS_MS = 120_000;

function setConfig(overrides: Record<string, any> = {}) {
  const config = {
    clients: { multipleUserSessions: true, multipleClientLogins: true },
    teams: { enabled: false },
    accessTokens: {
      jwtSecret: 'secret',
      mode: 'jwt',
      strictRevocation: false,
      tokenVersion: 4,
      expiryPeriod: ACCESS_MS,
      setCookie: false,
      cookieOptions: {},
      signing: { ...keys },
    },
    refreshTokens: {
      enabled: true,
      expiryPeriod: 7 * DAY,
      extendable: true,
      maxLifetime: 30 * DAY,
      setCookie: false,
      cookieOptions: {},
    },
    ...overrides,
  };
  ConfigController.getInstance().config = config;
  return config;
}

const verify = (token: string) =>
  verifyAccessToken(token, {
    tokenVersion: 4,
    signing: { kid: keys.kid, publicKey: keys.publicKey },
  });

const user = (extra: Record<string, any> = {}) =>
  ({ _id: 'u1', active: true, hasTwoFA: false, ...extra }) as unknown as User;

let fake: ReturnType<typeof createFakeRegistry>;
let redis: ReturnType<typeof createFakeRedis>;

beforeEach(() => {
  for (const key of Object.keys(tables)) tables[key] = [];
  for (const key of Object.keys(relationsByUser)) delete relationsByUser[key];
  findRelationCalls.length = 0;
  authorizationUp = true;
  resetTeamClaimsWarning();
  fake = createFakeRegistry();
  redis = createFakeRedis();
  configureSessionServices({ registry: () => fake.registry, redis: () => redis.redis });
});

describe('jwt mode minting', () => {
  it('signs EdDSA with the kid, claims exactly per AccessTokenClaims, no AccessToken row', async () => {
    const config = setConfig();
    const result = (await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    })) as { accessToken: string; refreshToken: string };
    const header = JSON.parse(
      Buffer.from(result.accessToken.split('.')[0], 'base64url').toString(),
    );
    assert.equal(header.alg, 'EdDSA');
    assert.equal(header.kid, keys.kid);

    assert.equal(table('AccessToken').length, 0);
    assert.equal(table('RefreshToken').length, 1);
    const row = table('RefreshToken')[0];
    assert.equal(row.accessToken, undefined);
    assert.equal(row.tokenHash, hashRefreshToken(result.refreshToken));

    const claims = verify(result.accessToken);
    assert.deepEqual(claims, {
      sub: 'u1',
      sid: row._id,
      cid: 'web',
      authorized: true,
      sudo: true,
      tv: 4,
      iat: claims.iat,
      exp: claims.iat + ACCESS_MS / 1000,
      iss: 'conduit',
    });
  });
  it('registers the session with the refresh token lifetime', async () => {
    const config = setConfig();
    await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    });
    const row = table('RefreshToken')[0];
    assert.equal(fake.calls.register.length, 1);
    const call = fake.calls.register[0];
    assert.equal(call.sid, row._id);
    assert.deepEqual(call.data, { user: 'u1', clientId: 'web', realm: null });
    const expected = new Date(row.expiresOn).getTime() - Date.now();
    assert.ok(Math.abs(call.ttlMs - expected) < 2000);
  });
  it('without refresh tokens: a fresh uuid sid, registered for the access lifetime', async () => {
    const config = setConfig({
      refreshTokens: {
        enabled: false,
        expiryPeriod: DAY,
        extendable: true,
        maxLifetime: DAY,
        setCookie: false,
        cookieOptions: {},
      },
    });
    const result = (await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    })) as { accessToken: string; refreshToken?: string };
    assert.equal(result.refreshToken, undefined);
    assert.equal(table('RefreshToken').length, 0);
    const claims = verify(result.accessToken);
    assert.match(claims.sid, /^[0-9a-f-]{36}$/);
    assert.equal(fake.calls.register[0].sid, claims.sid);
    assert.equal(fake.calls.register[0].ttlMs, ACCESS_MS);
  });
  it('a 2FA-pending token is unauthorized, has no refresh row and is registered', async () => {
    const config = setConfig();
    const result = (await provider.provideUserTokens({
      user: user({ hasTwoFA: true }),
      clientId: 'web',
      config: config as any,
      twoFaPass: false,
    })) as { accessToken: string };
    const claims = verify(result.accessToken);
    assert.equal(claims.authorized, false);
    assert.equal(claims.sudo, false);
    assert.equal(table('RefreshToken').length, 0);
    assert.equal(fake.calls.register[0].sid, claims.sid);
  });
  it('renew keeps the session id, never sudo, stores nothing', async () => {
    const config = setConfig();
    const login = (await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    })) as { accessToken: string; refreshToken: string };
    const row = table('RefreshToken')[0] as unknown as RefreshToken;
    const renewed: any = await provider.provideRenewedAccessToken(
      { user: user(), clientId: 'web', config: config as any },
      row,
      login.refreshToken,
    );
    const claims = verify(renewed.accessToken);
    assert.equal(claims.sid, row._id);
    assert.equal(claims.sudo, false);
    assert.equal(renewed.refreshToken, login.refreshToken);
    assert.equal(table('AccessToken').length, 0);
    // renew registers again (same sid, refresh row lifetime): heals a lost entry
    assert.equal(fake.calls.register.length, 2);
    assert.equal(fake.calls.register[1].sid, row._id);
    const again: any = await provider.provideRenewedAccessToken(
      { user: user(), clientId: 'web', config: config as any },
      row,
      login.refreshToken,
    );
    assert.equal(verify(again.accessToken).sid, row._id);
  });
  it('renew re-registers a lost registry entry, so strict revocation keeps working', async () => {
    const config = setConfig();
    config.accessTokens.strictRevocation = true;
    const login = (await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    })) as { refreshToken: string };
    const row = table('RefreshToken')[0] as unknown as RefreshToken;
    // Redis flush / failover
    fake.entries.clear();
    assert.equal(await fake.registry.exists(row._id), false);
    const renewed: any = await provider.provideRenewedAccessToken(
      { user: user(), clientId: 'web', config: config as any },
      row,
      login.refreshToken,
    );
    assert.equal(verify(renewed.accessToken).sid, row._id);
    assert.equal(await fake.registry.exists(row._id), true);
    const ttl = fake.entries.get(row._id)!.ttlMs;
    assert.ok(Math.abs(ttl - (new Date(row.expiresOn).getTime() - Date.now())) < 2000);
  });
  it('renew of a session swept meanwhile is refused and stays revoked', async () => {
    const config = setConfig();
    const ghost = {
      _id: 'ghost-row',
      accessToken: undefined,
      expiresOn: new Date(Date.now() + DAY),
    } as unknown as RefreshToken;
    await assert.rejects(
      provider.provideRenewedAccessToken(
        { user: user(), clientId: 'web', config: config as any },
        ghost,
        'x',
      ),
      e => e instanceof GrpcError && e.code === status.UNAUTHENTICATED,
    );
    assert.equal(fake.entries.has('ghost-row'), false);
  });
  it('renew under strict revocation fails closed when the registry is down', async () => {
    const config = setConfig();
    config.accessTokens.strictRevocation = true;
    fake.state.failing = true;
    await assert.rejects(
      provider.provideRenewedAccessToken(
        { user: user(), clientId: 'web', config: config as any },
        {
          _id: 'rt-x',
          expiresOn: new Date(Date.now() + DAY),
        } as unknown as RefreshToken,
        'x',
      ),
      e =>
        e instanceof GrpcError &&
        e.code === status.UNAVAILABLE &&
        getConduitCode(e) === authErrors.SESSION_REGISTRY_UNAVAILABLE.conduitCode,
    );
  });
  it('sudo reusing a uuid sid extends its registry entry; row sessions are left alone', async () => {
    const config = setConfig();
    const sid = '3f0c1b0e-6c0a-4d6e-9a43-0f6f2c1d7a11';
    fake.entries.set(sid, { data: { user: 'u1', clientId: 'web' }, ttlMs: 5 });
    await provider.provideSudoAccessToken({
      user: user(),
      clientId: 'web',
      config: config as any,
      sessionId: sid,
    });
    assert.deepEqual(fake.calls.touch, [{ sid, ttlMs: ACCESS_MS }]);
    assert.equal(fake.calls.register.length, 0);
    await provider.provideSudoAccessToken({
      user: user(),
      clientId: 'web',
      config: config as any,
      sessionId: 'rt-row-id',
    });
    assert.equal(fake.calls.touch.length, 1);
  });
  it('sudo mints with sudo and the presenting session id', async () => {
    const config = setConfig();
    const result = await provider.provideSudoAccessToken({
      user: user(),
      clientId: 'web',
      config: config as any,
      sessionId: 'rt-existing',
    });
    const claims = verify(result.accessToken);
    assert.equal(claims.sudo, true);
    assert.equal(claims.sid, 'rt-existing');
    assert.equal(fake.calls.register.length, 0);
    // without a session id it gets a fresh registered uuid
    const fresh = await provider.provideSudoAccessToken({
      user: user(),
      clientId: 'web',
      config: config as any,
    });
    const freshClaims = verify(fresh.accessToken);
    assert.equal(fake.calls.register[0].sid, freshClaims.sid);
  });
  it('missing signing keys fail UNAVAILABLE and leave no refresh row', async () => {
    const config = setConfig();
    config.accessTokens.signing = { ...keys, privateKey: '' };
    await assert.rejects(
      provider.provideUserTokens({
        user: user(),
        clientId: 'web',
        config: config as any,
      }),
      e => e instanceof GrpcError && e.code === status.UNAVAILABLE,
    );
    assert.equal(table('RefreshToken').length, 0);
  });
});

describe('team claims in jwt tokens', () => {
  const teams = (n: number, relation = 'member') =>
    Array.from({ length: n }, (_, i) => ({ relation, resource: `Team:t${i}` }));

  it('direct memberships as { id, role }, looked up with limit 21 and cached', async () => {
    const config = setConfig({ teams: { enabled: true } });
    relationsByUser.u1 = [
      { relation: 'owner', resource: 'Team:t1' },
      { relation: 'member', resource: 'Team:t2' },
    ];
    const mint = async () =>
      verify(
        (
          (await provider.provideUserTokensInternal({
            user: user(),
            clientId: 'web',
            config: config as any,
          })) as any
        ).accessToken,
      );
    const claims = await mint();
    assert.deepEqual(claims.teams, [
      { id: 't1', role: 'owner' },
      { id: 't2', role: 'member' },
    ]);
    assert.equal(claims.teamsTruncated, undefined);
    assert.deepEqual(findRelationCalls[0], {
      subject: 'User:u1',
      resourceType: 'Team',
      limit: 21,
    });
    await mint();
    assert.equal(findRelationCalls.length, 1);
    assert.equal(redis.ttls.get('auth_teams_u1'), 60_000);
  });
  it('caps at 20 and flags truncation', async () => {
    const config = setConfig({ teams: { enabled: true } });
    relationsByUser.u1 = teams(25);
    const r: any = await provider.provideUserTokensInternal({
      user: user(),
      clientId: 'web',
      config: config as any,
    });
    const claims = verify(r.accessToken);
    assert.equal(claims.teams?.length, 20);
    assert.equal(claims.teamsTruncated, true);
  });
  it('authorization unavailable: mints without teams', async () => {
    const config = setConfig({ teams: { enabled: true } });
    authorizationUp = false;
    const r: any = await provider.provideUserTokensInternal({
      user: user(),
      clientId: 'web',
      config: config as any,
    });
    const claims = verify(r.accessToken);
    assert.equal('teams' in claims, false);
  });
  it('teams feature off: no lookup, no claim', async () => {
    const config = setConfig();
    const r: any = await provider.provideUserTokensInternal({
      user: user(),
      clientId: 'web',
      config: config as any,
    });
    assert.equal('teams' in verify(r.accessToken), false);
    assert.equal(findRelationCalls.length, 0);
  });
});

describe('registry failures at mint', () => {
  it('are logged and ignored without strict revocation', async () => {
    const config = setConfig();
    fake.state.failing = true;
    const result: any = await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    });
    assert.ok(verify(result.accessToken));
  });
  it('with strict revocation fail closed (UNAVAILABLE) and leave no refresh row', async () => {
    const config = setConfig();
    config.accessTokens.strictRevocation = true;
    fake.state.failing = true;
    await assert.rejects(
      provider.provideUserTokens({
        user: user(),
        clientId: 'web',
        config: config as any,
      }),
      e => e instanceof GrpcError && e.code === status.UNAVAILABLE,
    );
    assert.equal(table('RefreshToken').length, 0);
  });
});

describe('session mode', () => {
  it('keeps HS256 and the AccessToken row, and registers the refresh session', async () => {
    const config = setConfig();
    config.accessTokens.mode = 'session';
    const result = (await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    })) as { accessToken: string; refreshToken: string };
    const decoded = jwt.verify(result.accessToken, 'secret') as any;
    assert.equal(decoded.id, 'u1');
    assert.equal(table('AccessToken').length, 1);
    const row = table('RefreshToken')[0];
    assert.equal(row.accessToken, table('AccessToken')[0]._id);
    assert.equal(table('AccessToken')[0].session, row._id);
    assert.equal(fake.calls.register.length, 1);
    assert.equal(fake.calls.register[0].sid, row._id);
  });
  it('renew registers the session with a positive ttl', async () => {
    const config = setConfig();
    config.accessTokens.mode = 'session';
    const login = (await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    })) as { accessToken: string; refreshToken: string };
    const row = table('RefreshToken')[0] as unknown as RefreshToken;
    const before = fake.calls.register.length;
    await provider.provideRenewedAccessToken(
      { user: user(), clientId: 'web', config: config as any },
      row,
      login.refreshToken,
    );
    assert.equal(fake.calls.register.length, before + 1);
    const call = fake.calls.register[before];
    assert.equal(call.sid, row._id);
    assert.ok(call.ttlMs > 0);
  });
  it('registers nothing without a refresh row', async () => {
    const config = setConfig();
    config.accessTokens.mode = 'session';
    config.refreshTokens.enabled = false;
    await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    });
    assert.equal(fake.calls.register.length, 0);
  });
  it('registry outages never fail a session-mode login', async () => {
    const config = setConfig();
    config.accessTokens.mode = 'session';
    config.accessTokens.strictRevocation = true;
    fake.state.failing = true;
    const result: any = await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    });
    assert.ok(result.accessToken);
  });
});

describe('uuid sessions (no refresh row)', () => {
  const noRefresh = () =>
    setConfig({
      refreshTokens: {
        enabled: false,
        expiryPeriod: DAY,
        extendable: true,
        maxLifetime: DAY,
        setCookie: false,
        cookieOptions: {},
      },
    });
  const login = async (config: any, id = 'u1') =>
    verify(
      (
        (await provider.provideUserTokensInternal({
          user: user({ _id: id }),
          clientId: 'web',
          config,
        })) as any
      ).accessToken,
    ).sid;

  it('are indexed per user and revoked by a user-scoped sweep', async () => {
    const config = noRefresh();
    const sid = await login(config);
    const other = await login(config, 'u2');
    assert.ok(redis.sets.get('auth_user_sessions_u1')!.has(sid));
    assert.equal(redis.ttls.get('auth_user_sessions_u1'), ACCESS_MS);
    await provider.deleteUserTokens({ user: 'u1' });
    assert.equal(fake.entries.has(sid), false);
    assert.ok(fake.entries.has(other));
    assert.equal(redis.sets.has('auth_user_sessions_u1'), false);
  });
  it('are not reachable by realm or client scoped sweeps', async () => {
    const config = noRefresh();
    const sid = await login(config);
    await provider.deleteUserTokens({ realm: 'r1' });
    await provider.deleteUserTokens({ user: 'u1', clientId: 'web' });
    assert.ok(fake.entries.has(sid));
  });
});

describe('revocation', () => {
  it('logout (session mode) revokes the session of the access token', async () => {
    const config = setConfig();
    config.accessTokens.mode = 'session';
    const result = (await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    })) as { accessToken: string };
    const sid = table('RefreshToken')[0]._id;
    assert.ok(fake.entries.has(sid));
    await provider.logOutClientOperations(
      grpcSdk,
      config.clients,
      result.accessToken,
      'web',
      'u1',
    );
    assert.equal(table('RefreshToken').length, 0);
    assert.equal(table('AccessToken').length, 0);
    assert.equal(fake.entries.has(sid), false);
    assert.deepEqual(fake.calls.revokeMany.flat(), [sid]);
  });
  it('logout with multipleUserSessions off sweeps and revokes the sessions of the client', async () => {
    const config = setConfig();
    await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    });
    await provider.provideUserTokens({
      user: user(),
      clientId: 'ios',
      config: config as any,
    });
    const web = table('RefreshToken').find(r => r.clientId === 'web')!._id;
    const ios = table('RefreshToken').find(r => r.clientId === 'ios')!._id;
    config.clients.multipleUserSessions = false;
    await provider.logOutClientOperations(grpcSdk, config.clients, 'x', 'web', 'u1');
    assert.deepEqual(
      table('RefreshToken').map(r => r._id),
      [ios],
    );
    assert.deepEqual(fake.calls.revokeMany.flat(), [web]);
    assert.ok(fake.entries.has(ios));
  });
  it('login without multiple sessions revokes the replaced sessions', async () => {
    const config = setConfig();
    config.clients.multipleUserSessions = false;
    await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    });
    const first = table('RefreshToken')[0]._id;
    await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    });
    assert.equal(fake.entries.has(first), false);
    assert.equal(table('RefreshToken').length, 1);
    assert.equal(fake.entries.size, 1);
  });
  it('deleteUserTokens revokes the fetched ids; other users are untouched', async () => {
    const config = setConfig();
    await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    });
    await provider.provideUserTokens({
      user: user({ _id: 'u2' }),
      clientId: 'web',
      config: config as any,
    });
    const mine = table('RefreshToken').find(r => r.user === 'u1')!._id;
    const theirs = table('RefreshToken').find(r => r.user === 'u2')!._id;
    await provider.deleteUserTokens({ user: 'u1' });
    assert.deepEqual(fake.calls.revokeMany.flat(), [mine]);
    assert.ok(fake.entries.has(theirs));
  });
  it('a registry failure on a sweep is not fatal', async () => {
    const config = setConfig();
    await provider.provideUserTokens({
      user: user(),
      clientId: 'web',
      config: config as any,
    });
    fake.state.failing = true;
    await provider.deleteUserTokens({ user: 'u1' });
    assert.equal(table('RefreshToken').length, 0);
  });
});
