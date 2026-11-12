import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk, getConduitCode, GrpcError } from '@conduitplatform/grpc-sdk';
import { errors } from '../errors.js';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { CommonHandlers } from './common.js';
import { TokenProvider } from './tokenProvider.js';
import { AccessToken, RefreshToken, User } from '../models/index.js';
import { hashRefreshToken } from '../utils/refreshToken.logic.js';
import { createFakeDatabase } from '../utils/fakeDatabase.testutil.js';
import { createFakeRegistry } from '../utils/fakeSession.testutil.js';
import { configureSessionServices } from '../utils/sessionServices.js';

const { table, tables, database } = createFakeDatabase();
AccessToken.getInstance(database);
RefreshToken.getInstance(database);
User.getInstance(database);

const grpcSdk = { database } as unknown as ConduitGrpcSdk;
TokenProvider.getInstance(grpcSdk);
const handlers = new CommonHandlers(grpcSdk);

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function setConfig(overrides: Record<string, any> = {}) {
  ConfigController.getInstance().config = {
    clients: { multipleUserSessions: true, multipleClientLogins: true },
    accessTokens: {
      jwtSecret: 'secret',
      expiryPeriod: HOUR,
      setCookie: false,
      cookieOptions: { httpOnly: true },
    },
    refreshTokens: {
      enabled: true,
      expiryPeriod: 7 * DAY,
      extendable: true,
      maxLifetime: 30 * DAY,
      setCookie: false,
      cookieOptions: { httpOnly: true },
    },
    ...overrides,
  };
}

function seedSession(row: Record<string, any> = {}) {
  table('User').push({ _id: 'u1', active: true });
  table('AccessToken').push({ _id: 'at-old', user: 'u1', token: 'old.jwt' });
  const issuedAt = new Date(Date.now() - DAY);
  table('RefreshToken').push({
    _id: 'rt1',
    user: 'u1',
    clientId: 'web',
    tokenHash: hashRefreshToken('plain-refresh'),
    accessToken: 'at-old',
    issuedAt,
    extendable: true,
    maxExpiresOn: new Date(issuedAt.getTime() + 30 * DAY),
    expiresOn: new Date(Date.now() + DAY),
    ...row,
  });
}

function call(context: Record<string, any> = {}) {
  return {
    request: {
      params: {},
      bodyParams: {},
      headers: {},
      cookies: {},
      context: { clientId: 'web', refreshToken: 'plain-refresh', ...context },
    },
  } as any;
}

beforeEach(() => {
  for (const key of Object.keys(tables)) tables[key] = [];
  setConfig();
});

describe('renewAuth', () => {
  it('mints an access token, keeps the refresh token and echoes the presented one', async () => {
    seedSession();
    const res: any = await handlers.renewAuth(call());
    assert.ok(res.accessToken);
    assert.equal(res.refreshToken, 'plain-refresh');
    assert.equal(table('RefreshToken').length, 1);
    // the previous access token row is replaced and linked to the session
    assert.equal(
      table('AccessToken').some(r => r._id === 'at-old'),
      false,
    );
    const fresh = table('AccessToken')[0];
    assert.equal(fresh.session, 'rt1');
    assert.equal(table('RefreshToken')[0].accessToken, fresh._id);
  });
  it('with cookies on, sets the access cookie and leaves the refresh token out of the body', async () => {
    seedSession();
    setConfig({
      accessTokens: {
        jwtSecret: 's',
        expiryPeriod: HOUR,
        setCookie: true,
        cookieOptions: {},
      },
      refreshTokens: {
        enabled: true,
        expiryPeriod: 7 * DAY,
        extendable: true,
        maxLifetime: 30 * DAY,
        setCookie: true,
        cookieOptions: {},
      },
    });
    const res: any = await handlers.renewAuth(call());
    assert.equal(res.setCookies.length, 1);
    assert.equal(res.setCookies[0].name, 'accessToken');
    assert.equal(res.result.refreshToken, undefined);
  });
  it('rejects unknown, expired and wrong-client tokens', async () => {
    seedSession();
    await assert.rejects(
      handlers.renewAuth(call({ refreshToken: 'nope' })),
      (e: any) =>
        e.code === status.UNAUTHENTICATED &&
        getConduitCode(e) === errors.REFRESH_TOKEN_INVALID.conduitCode,
    );
    await assert.rejects(
      handlers.renewAuth(call({ clientId: 'other' })),
      (e: any) => e.code === status.UNAUTHENTICATED,
    );
    table('RefreshToken')[0].expiresOn = new Date(Date.now() - 1000);
    await assert.rejects(
      handlers.renewAuth(call()),
      (e: any) =>
        e.code === status.UNAUTHENTICATED &&
        getConduitCode(e) === errors.REFRESH_TOKEN_INVALID.conduitCode,
    );
  });
  it('finds a legacy plaintext row and migrates it on the spot', async () => {
    table('User').push({ _id: 'u1', active: true });
    table('RefreshToken').push({
      _id: 'rt-legacy',
      user: 'u1',
      clientId: 'web',
      token: 'plain-refresh',
      createdAt: new Date(Date.now() - DAY),
      expiresOn: new Date(Date.now() + DAY),
    });
    const res: any = await handlers.renewAuth(call());
    assert.ok(res.accessToken);
    const row = table('RefreshToken')[0];
    assert.equal(row.tokenHash, hashRefreshToken('plain-refresh'));
    assert.equal(row.token, null);
    assert.ok(row.maxExpiresOn);
  });
});

describe('extendRefresh', () => {
  it('extends to now + expiryPeriod, capped by maxExpiresOn', async () => {
    seedSession();
    const res: any = await handlers.extendRefresh(call());
    const expected = Date.now() + 7 * DAY;
    assert.ok(Math.abs(res.expiresOn.getTime() - expected) < 5000);
    // near the cap: clamped
    const cap = new Date(Date.now() + 2 * DAY);
    table('RefreshToken')[0].maxExpiresOn = cap;
    const clamped: any = await handlers.extendRefresh(call());
    assert.equal(clamped.expiresOn.getTime(), cap.getTime());
    assert.equal(table('RefreshToken')[0].expiresOn.getTime(), cap.getTime());
  });
  it('touches the registry entry with the new lifetime', async () => {
    seedSession();
    const fake = createFakeRegistry();
    configureSessionServices({ registry: () => fake.registry });
    const res: any = await handlers.extendRefresh(call());
    assert.equal(fake.calls.touch.length, 1);
    assert.equal(fake.calls.touch[0].sid, 'rt1');
    assert.ok(
      Math.abs(fake.calls.touch[0].ttlMs - (res.expiresOn.getTime() - Date.now())) < 5000,
    );
  });
  it('refuses a non-extendable token', async () => {
    seedSession({ extendable: false });
    await assert.rejects(
      handlers.extendRefresh(call()),
      (e: any) =>
        e.code === status.FAILED_PRECONDITION &&
        getConduitCode(e) === errors.REFRESH_TOKEN_NOT_EXTENDABLE.conduitCode,
    );
  });
  it('honors a policy tightened after mint', async () => {
    seedSession();
    setConfig({
      refreshTokens: {
        enabled: true,
        expiryPeriod: 7 * DAY,
        extendable: false,
        maxLifetime: 30 * DAY,
        setCookie: false,
        cookieOptions: {},
      },
    });
    await assert.rejects(
      handlers.extendRefresh(call()),
      (e: any) =>
        e.code === status.FAILED_PRECONDITION &&
        getConduitCode(e) === errors.REFRESH_TOKEN_NOT_EXTENDABLE.conduitCode,
    );
    // a shorter global maxLifetime caps the extension at issuedAt + maxLifetime
    setConfig({
      refreshTokens: {
        enabled: true,
        expiryPeriod: 2 * DAY,
        extendable: true,
        maxLifetime: 3 * DAY,
        setCookie: false,
        cookieOptions: {},
      },
    });
    const res: any = await handlers.extendRefresh(call());
    const issuedAt = table('RefreshToken')[0].issuedAt.getTime();
    assert.equal(res.expiresOn.getTime(), issuedAt + 3 * DAY);
  });
  it('re-sets the refresh cookie with the new lifetime when cookies are on', async () => {
    seedSession();
    setConfig({
      refreshTokens: {
        enabled: true,
        expiryPeriod: 7 * DAY,
        extendable: true,
        maxLifetime: 30 * DAY,
        setCookie: true,
        cookieOptions: { httpOnly: true },
      },
    });
    const res: any = await handlers.extendRefresh(call());
    const cookie = res.setCookies[0];
    assert.equal(cookie.name, 'refreshToken');
    assert.equal(cookie.value, 'plain-refresh');
    assert.ok(Math.abs(cookie.options.maxAge - (7 * DAY) / 1000) <= 5);
    assert.ok(res.result.expiresOn instanceof Date);
  });
});

describe('logOut', () => {
  const logoutCall = (context: Record<string, any>) =>
    ({
      request: {
        params: {},
        headers: { authorization: 'Bearer old.jwt' },
        cookies: {},
        context: { clientId: 'web', user: { _id: 'u1' }, ...context },
      },
    }) as any;
  it('deletes the session refresh token carried by the context', async () => {
    seedSession();
    assert.equal(await handlers.logOut(logoutCall({ sessionId: 'rt1' })), 'LoggedOut');
    assert.equal(table('RefreshToken').length, 0);
  });
  it('jwt session with a uuid sid: no row lookup (a MongoDB cast error), the registry entry is still revoked', async () => {
    const sid = '3f0c1b0e-6c0a-4d6e-9a43-0f6f2c1d7a11';
    const fake = createFakeRegistry();
    fake.entries.set(sid, { data: { user: 'u1', clientId: 'web' }, ttlMs: 1000 });
    configureSessionServices({ registry: () => fake.registry });
    const model = RefreshToken.getInstance();
    const original = model.deleteOne.bind(model);
    const seen: unknown[] = [];
    model.deleteOne = (async (query: any) => {
      seen.push(query);
      if (String(query._id).includes('-')) throw new Error('CastError');
      return original(query);
    }) as typeof model.deleteOne;
    try {
      assert.equal(await handlers.logOut(logoutCall({ sessionId: sid })), 'LoggedOut');
    } finally {
      model.deleteOne = original;
    }
    assert.equal(seen.length, 0);
    assert.equal(fake.entries.has(sid), false);
    assert.deepEqual(fake.calls.revokeMany.flat(), [sid]);
  });
  it('a failing row delete never skips the registry revoke', async () => {
    seedSession();
    const fake = createFakeRegistry();
    fake.entries.set('rt1', { data: { user: 'u1', clientId: 'web' }, ttlMs: 1000 });
    configureSessionServices({ registry: () => fake.registry });
    const model = RefreshToken.getInstance();
    const original = model.deleteOne.bind(model);
    model.deleteOne = (async (query: any) => {
      // the logout's own session delete (scoped to the user) fails
      if (query.user) throw new Error('db down');
      return original(query);
    }) as typeof model.deleteOne;
    try {
      await handlers.logOut(logoutCall({ sessionId: 'rt1' }));
    } finally {
      model.deleteOne = original;
    }
    assert.equal(fake.entries.has('rt1'), false);
  });
  it('never deletes a session that belongs to another user', async () => {
    seedSession({ user: 'u2', accessToken: 'other-at' });
    await handlers.logOut(logoutCall({ sessionId: 'rt1' }));
    assert.equal(table('RefreshToken').length, 1);
  });
  it('through a sudo access token linked to the session, ends the session', async () => {
    seedSession();
    table('AccessToken').push({
      _id: 'at-sudo',
      user: 'u1',
      token: 'sudo.jwt',
      session: 'rt1',
    });
    const c = logoutCall({});
    c.request.headers.authorization = 'Bearer sudo.jwt';
    await handlers.logOut(c);
    assert.equal(table('RefreshToken').length, 0);
    assert.equal(
      table('AccessToken').some(r => r.token === 'sudo.jwt'),
      false,
    );
  });
});

describe('mint links', () => {
  it('provideSudoAccessToken links the sudo token to the session and creates no refresh token', async () => {
    table('User').push({ _id: 'u1', active: true });
    const res = await TokenProvider.getInstance().provideSudoAccessToken({
      user: { _id: 'u1', active: true } as any,
      clientId: 'web',
      config: ConfigController.getInstance().config,
      sessionId: 'rt9',
    });
    assert.ok(res.accessToken);
    assert.equal(table('RefreshToken').length, 0);
    assert.equal(table('AccessToken')[0].session, 'rt9');
    void GrpcError;
  });
});
