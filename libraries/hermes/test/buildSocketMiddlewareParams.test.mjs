import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSocketMiddlewareParams } from '../.test-dist/Socket/buildSocketMiddlewareParams.js';

function createMockSocket({ auth = {}, headers = {}, conduit, data } = {}) {
  return {
    handshake: { auth },
    request: {
      headers: { ...headers },
      ...(conduit !== undefined ? { conduit } : {}),
    },
    data,
  };
}

test('buildSocketMiddlewareParams bridges auth.token to Bearer authorization', () => {
  const socket = createMockSocket({
    auth: { token: 'my-token' },
  });

  const params = buildSocketMiddlewareParams(socket);

  assert.equal(params.headers.authorization, 'Bearer my-token');
});

test('buildSocketMiddlewareParams bridges auth.accessToken to Bearer authorization', () => {
  const socket = createMockSocket({
    auth: { accessToken: 'access-token-value' },
  });

  const params = buildSocketMiddlewareParams(socket);

  assert.equal(params.headers.authorization, 'Bearer access-token-value');
});

test('buildSocketMiddlewareParams preserves lowercase authorization header', () => {
  const socket = createMockSocket({
    auth: { token: 'socket-token' },
    headers: { authorization: 'Bearer existing-token' },
  });

  const params = buildSocketMiddlewareParams(socket);

  assert.equal(params.headers.authorization, 'Bearer existing-token');
});

test('buildSocketMiddlewareParams preserves capital Authorization header', () => {
  const socket = createMockSocket({
    auth: { token: 'socket-token' },
    headers: { Authorization: 'Bearer existing-token' },
  });

  const params = buildSocketMiddlewareParams(socket);

  assert.equal(params.headers.Authorization, 'Bearer existing-token');
  assert.equal(params.headers.authorization, undefined);
});

test('buildSocketMiddlewareParams passes auth.authorization when no existing header', () => {
  const socket = createMockSocket({
    auth: { authorization: 'Custom scheme-value' },
  });

  const params = buildSocketMiddlewareParams(socket);

  assert.equal(params.headers.authorization, 'Custom scheme-value');
});

test('buildSocketMiddlewareParams does not override existing header with auth.authorization', () => {
  const socket = createMockSocket({
    auth: {
      token: 'ignored-token',
      authorization: 'Custom scheme-value',
    },
    headers: { authorization: 'Bearer existing-token' },
  });

  const params = buildSocketMiddlewareParams(socket);

  assert.equal(params.headers.authorization, 'Bearer existing-token');
});

test('buildSocketMiddlewareParams leaves headers unchanged when handshake.auth is missing or empty', () => {
  const socketWithoutAuth = createMockSocket({
    headers: { 'x-custom': 'value' },
  });
  const socketWithEmptyAuth = createMockSocket({
    auth: {},
    headers: { 'x-custom': 'value' },
  });

  const paramsWithoutAuth = buildSocketMiddlewareParams(socketWithoutAuth);
  const paramsWithEmptyAuth = buildSocketMiddlewareParams(socketWithEmptyAuth);

  assert.equal(paramsWithoutAuth.headers.authorization, undefined);
  assert.equal(paramsWithoutAuth.headers.Authorization, undefined);
  assert.equal(paramsWithoutAuth.headers['x-custom'], 'value');
  assert.equal(paramsWithEmptyAuth.headers.authorization, undefined);
  assert.equal(paramsWithEmptyAuth.headers.Authorization, undefined);
  assert.equal(paramsWithEmptyAuth.headers['x-custom'], 'value');
});

test('buildSocketMiddlewareParams returns empty cookies even when cookie header exists', () => {
  const socket = createMockSocket({
    headers: { cookie: 'accessToken=abc; refreshToken=xyz' },
  });

  const params = buildSocketMiddlewareParams(socket);

  assert.deepEqual(params.cookies, {});
});

test('buildSocketMiddlewareParams merges conduit request context and socket data', () => {
  const socket = createMockSocket({
    conduit: { userId: 'user-1', role: 'admin' },
    data: { sessionId: 'session-1' },
  });

  const params = buildSocketMiddlewareParams(socket);

  assert.deepEqual(params.context, {
    userId: 'user-1',
    role: 'admin',
    sessionId: 'session-1',
  });
});
