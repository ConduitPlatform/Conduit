import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildSocketMiddlewareParams,
  parseCookieHeader,
} from '../dist/Socket/buildSocketMiddlewareParams.js';

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

test('parseCookieHeader parses semicolon-separated cookies', () => {
  const cookies = parseCookieHeader('accessToken=abc; refreshToken=xyz');
  assert.equal(cookies.accessToken, 'abc');
  assert.equal(cookies.refreshToken, 'xyz');
});

test('parseCookieHeader returns empty object for missing header', () => {
  assert.deepEqual(parseCookieHeader(undefined), {});
  assert.deepEqual(parseCookieHeader(''), {});
});

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

test('buildSocketMiddlewareParams does not overwrite existing authorization header', () => {
  const socket = createMockSocket({
    auth: { token: 'socket-token' },
    headers: { authorization: 'Bearer existing-token' },
  });

  const params = buildSocketMiddlewareParams(socket);

  assert.equal(params.headers.authorization, 'Bearer existing-token');
});

test('buildSocketMiddlewareParams passes auth.authorization through as-is', () => {
  const socket = createMockSocket({
    auth: {
      token: 'ignored-token',
      authorization: 'Custom scheme-value',
    },
    headers: { authorization: 'Bearer existing-token' },
  });

  const params = buildSocketMiddlewareParams(socket);

  assert.equal(params.headers.authorization, 'Custom scheme-value');
});

test('buildSocketMiddlewareParams parses cookies from cookie header', () => {
  const socket = createMockSocket({
    headers: { cookie: 'accessToken=abc; refreshToken=xyz' },
  });

  const params = buildSocketMiddlewareParams(socket);

  assert.equal(params.cookies.accessToken, 'abc');
  assert.equal(params.cookies.refreshToken, 'xyz');
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
