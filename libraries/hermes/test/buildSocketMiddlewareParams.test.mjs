import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildSocketMiddlewareParams } from '../.test-dist/Socket/buildSocketMiddlewareParams.js';

function createMockSocket({ auth = {}, headers = {}, conduit, data } = {}) {
  return {
    handshake: { auth },
    request: { headers: { ...headers }, conduit },
    data,
  };
}

test('buildSocketMiddlewareParams bridges auth.token to Bearer authorization', () => {
  const params = buildSocketMiddlewareParams(
    createMockSocket({ auth: { token: 'my-token' } }),
  );
  assert.equal(params.headers.authorization, 'Bearer my-token');
});

test('buildSocketMiddlewareParams bridges auth.accessToken to Bearer authorization', () => {
  const params = buildSocketMiddlewareParams(
    createMockSocket({ auth: { accessToken: 'access-token-value' } }),
  );
  assert.equal(params.headers.authorization, 'Bearer access-token-value');
});

test('buildSocketMiddlewareParams preserves lowercase authorization header', () => {
  const params = buildSocketMiddlewareParams(
    createMockSocket({
      auth: { token: 'socket-token' },
      headers: { authorization: 'Bearer existing-token' },
    }),
  );
  assert.equal(params.headers.authorization, 'Bearer existing-token');
});

test('buildSocketMiddlewareParams preserves capital Authorization header', () => {
  const params = buildSocketMiddlewareParams(
    createMockSocket({
      auth: { token: 'socket-token' },
      headers: { Authorization: 'Bearer capital-token' },
    }),
  );
  assert.equal(params.headers.Authorization, 'Bearer capital-token');
  assert.equal(params.headers.authorization, undefined);
});

test('buildSocketMiddlewareParams sets auth.authorization when no header exists', () => {
  const params = buildSocketMiddlewareParams(
    createMockSocket({
      auth: { authorization: 'Custom scheme-value' },
    }),
  );
  assert.equal(params.headers.authorization, 'Custom scheme-value');
});

test('buildSocketMiddlewareParams does not override existing header with auth.authorization', () => {
  const params = buildSocketMiddlewareParams(
    createMockSocket({
      auth: {
        token: 'ignored-token',
        authorization: 'Custom scheme-value',
      },
      headers: { authorization: 'Bearer existing-token' },
    }),
  );
  assert.equal(params.headers.authorization, 'Bearer existing-token');
});

test('buildSocketMiddlewareParams leaves headers unchanged when handshake.auth is missing or empty', () => {
  const withoutAuth = buildSocketMiddlewareParams(
    createMockSocket({ headers: { 'x-custom': 'value' } }),
  );
  assert.equal(withoutAuth.headers.authorization, undefined);
  assert.equal(withoutAuth.headers['x-custom'], 'value');

  const emptyAuth = buildSocketMiddlewareParams(
    createMockSocket({ auth: {}, headers: { 'x-custom': 'value' } }),
  );
  assert.equal(emptyAuth.headers.authorization, undefined);
  assert.equal(emptyAuth.headers['x-custom'], 'value');
});

test('buildSocketMiddlewareParams returns empty cookies even when cookie header exists', () => {
  const params = buildSocketMiddlewareParams(
    createMockSocket({
      headers: { cookie: 'accessToken=abc; refreshToken=xyz' },
    }),
  );
  assert.deepEqual(params.cookies, {});
});

test('buildSocketMiddlewareParams merges conduit request context and socket data', () => {
  const params = buildSocketMiddlewareParams(
    createMockSocket({
      conduit: { userId: 'user-1', role: 'admin' },
      data: { sessionId: 'session-1' },
    }),
  );
  assert.deepEqual(params.context, {
    userId: 'user-1',
    role: 'admin',
    sessionId: 'session-1',
  });
});
