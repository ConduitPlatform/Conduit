import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AccessTokenClaims, GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import jwt from 'jsonwebtoken';
import { handleAuthentication } from './middleware.js';
import { JwtAuthenticationDeps } from './jwtAuthentication.logic.js';
import { AccessToken, User } from '../models/index.js';
import { createFakeDatabase } from '../utils/fakeDatabase.testutil.js';
import { createFakeRegistry } from '../utils/fakeSession.testutil.js';

const { table, tables, database } = createFakeDatabase();
AccessToken.getInstance(database);
User.getInstance(database);

function claims(overrides: Partial<AccessTokenClaims> = {}): AccessTokenClaims {
  return {
    sub: 'u1',
    sid: 'sid1',
    cid: 'web',
    authorized: true,
    sudo: false,
    tv: 1,
    iat: 1,
    exp: 2,
    iss: 'conduit',
    ...overrides,
  };
}

function setup(
  options: {
    claims?: Partial<AccessTokenClaims>;
    strict?: boolean;
    user?: Record<string, any> | null;
    verifyError?: GrpcError;
    realmsOff?: boolean;
  } = {},
) {
  const registry = createFakeRegistry();
  registry.entries.set('sid1', {
    data: { user: 'u1', clientId: 'web' },
    ttlMs: 1000,
  });
  const verifyCalls: { token: string; clientId?: string }[] = [];
  const resolved: string[] = [];
  const deps: JwtAuthenticationDeps = {
    verifier: {
      strictRevocation: options.strict ?? false,
      verify: (token, opts) => {
        verifyCalls.push({ token, clientId: opts?.clientId });
        if (options.verifyError) throw options.verifyError;
        return claims(options.claims);
      },
    },
    registry: registry.registry,
    realmsEnabled: () => options.realmsOff !== true,
    resolveUser: async id => {
      resolved.push(id);
      const user = options.user === undefined ? { _id: id, active: true } : options.user;
      if (!user) throw new GrpcError(status.NOT_FOUND, 'User not found');
      return user;
    },
  };
  return { deps, registry, verifyCalls, resolved };
}

const bearer = { authorization: 'Bearer tok' };
const code = (e: unknown) => (e instanceof GrpcError ? e.code : undefined);

function setMode(mode: 'session' | 'jwt') {
  ConfigController.getInstance().config = { accessTokens: { mode, jwtSecret: 's' } };
}

beforeEach(() => {
  for (const key of Object.keys(tables)) tables[key] = [];
  setMode('jwt');
});

describe('handleAuthentication (jwt mode)', () => {
  it('returns user, payload, realm and session id', async () => {
    const t = setup({ claims: { rid: 'r1' } });
    const result: any = await handleAuthentication(
      { clientId: 'web' },
      bearer,
      {},
      '/x',
      t.deps,
    );
    assert.equal(result.user._id, 'u1');
    assert.equal(result.jwtPayload.sid, 'sid1');
    assert.equal(result.realm, 'r1');
    assert.equal(result.sessionId, 'sid1');
    assert.deepEqual(t.verifyCalls, [{ token: 'tok', clientId: 'web' }]);
    assert.deepEqual(t.resolved, ['u1']);
  });
  it('the realm is gated on the realms feature like the session branch', async () => {
    const t = setup({ claims: { rid: 'r1' }, realmsOff: true });
    const result: any = await handleAuthentication({}, bearer, {}, '/x', t.deps);
    assert.equal(result.realm, null);
  });
  it('global sessions have realm null; the token may come from the cookie', async () => {
    const t = setup();
    const result: any = await handleAuthentication(
      {},
      {},
      { accessToken: 'cookie-tok' },
      '/x',
      t.deps,
    );
    assert.equal(result.realm, null);
    assert.equal(t.verifyCalls[0].token, 'cookie-tok');
    assert.equal(t.verifyCalls[0].clientId, undefined);
  });
  it('propagates verifier failures and never reads the user', async () => {
    const t = setup({ verifyError: new GrpcError(status.UNAUTHENTICATED, 'expired') });
    await assert.rejects(
      handleAuthentication({}, bearer, {}, '/x', t.deps),
      e => code(e) === status.UNAUTHENTICATED,
    );
    assert.equal(t.resolved.length, 0);
  });
  it('requires 2FA except on the 2FA paths', async () => {
    const t = setup({ claims: { authorized: false } });
    await assert.rejects(
      handleAuthentication({}, bearer, {}, '/authentication/local', t.deps),
      e => code(e) === status.UNAUTHENTICATED && /2FA/.test((e as Error).message),
    );
    for (const path of [
      '/authentication/twoFa/verify',
      '/authentication/twoFa/authorize',
      '/authentication/twoFa/recover',
    ]) {
      await handleAuthentication({}, bearer, {}, path, t.deps);
    }
  });
  it('rejects blocked users and deleted users as PERMISSION_DENIED', async () => {
    const blocked = setup({ user: { _id: 'u1', active: false } });
    await assert.rejects(
      handleAuthentication({}, bearer, {}, '/x', blocked.deps),
      e => code(e) === status.PERMISSION_DENIED,
    );
    const deleted = setup({ user: null });
    await assert.rejects(
      handleAuthentication({}, bearer, {}, '/x', deleted.deps),
      e => code(e) === status.PERMISSION_DENIED,
    );
  });
  it('strict revocation: a revoked session is rejected', async () => {
    const t = setup({ strict: true });
    await handleAuthentication({}, bearer, {}, '/x', t.deps);
    await t.registry.registry.revoke('sid1');
    await assert.rejects(
      handleAuthentication({}, bearer, {}, '/x', t.deps),
      e => code(e) === status.UNAUTHENTICATED,
    );
  });
  it('strict revocation fails closed (UNAVAILABLE) when the registry is down', async () => {
    const t = setup({ strict: true });
    t.registry.state.failing = true;
    await assert.rejects(
      handleAuthentication({}, bearer, {}, '/x', t.deps),
      e => code(e) === status.UNAVAILABLE,
    );
  });
  it('without strict revocation the registry is not consulted', async () => {
    const t = setup({ strict: false });
    t.registry.state.failing = true;
    await handleAuthentication({}, bearer, {}, '/x', t.deps);
  });
});

describe('handleAuthentication (session mode)', () => {
  it('is unchanged: it still goes through the access token row and returns the session', async () => {
    setMode('session');
    // the HS256 signature is verified first
    const token = jwt.sign({ id: 'u1', authorized: true }, 's', { expiresIn: 60 });
    table('User').push({ _id: 'u1', active: true });
    table('AccessToken').push({
      _id: 'at1',
      user: 'u1',
      clientId: 'web',
      token,
      session: 'rt1',
    });
    const result: any = await handleAuthentication(
      { clientId: 'web' },
      { authorization: `Bearer ${token}` },
      {},
      '/x',
    );
    assert.equal(result.user._id, 'u1');
    assert.equal(result.sessionId, 'rt1');
    assert.equal(result.realm, null);
    await assert.rejects(
      handleAuthentication(
        { clientId: 'other' },
        { authorization: `Bearer ${token}` },
        {},
        '/x',
      ),
      e => code(e) === status.UNAUTHENTICATED,
    );
  });
});
