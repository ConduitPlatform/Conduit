import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitError } from '@conduitplatform/grpc-sdk';
import { toErrorResponse, toSocketConnectError } from './errors.js';

const typed = (code: number, conduitCode: string, message = 'm') => {
  const details = JSON.stringify({ message, conduitCode });
  return Object.assign(new Error(`${code} X: ${details}`), { code, details });
};

describe('toErrorResponse', () => {
  it('exposes the conduitCode of a typed module error', () => {
    assert.deepEqual(toErrorResponse(typed(5, 'FILE_NOT_FOUND', 'File does not exist')), {
      name: 'NOT_FOUND',
      status: 404,
      message: 'File does not exist',
      conduitCode: 'FILE_NOT_FOUND',
    });
  });

  it('serves conflict, precondition, rate limit and availability statuses', () => {
    assert.equal(toErrorResponse(typed(6, 'A')).status, 409);
    assert.equal(toErrorResponse(typed(9, 'A')).status, 412);
    assert.equal(toErrorResponse(typed(8, 'A')).status, 429);
    assert.equal(toErrorResponse(typed(14, 'A')).status, 503);
    assert.equal(toErrorResponse(typed(12, 'A')).status, 501);
    assert.equal(toErrorResponse(typed(4, 'A')).status, 504);
  });

  it('keeps untyped gRPC errors as plain messages', () => {
    const err = Object.assign(new Error('7 PERMISSION_DENIED: nope'), {
      code: 7,
      details: 'nope',
    });
    assert.deepEqual(toErrorResponse(err), {
      name: 'FORBIDDEN',
      status: 403,
      message: 'nope',
    });
  });

  it('passes ConduitErrors through with their optional code', () => {
    assert.deepEqual(toErrorResponse(ConduitError.notFound('gone')), {
      name: 'NOT_FOUND',
      status: 404,
      message: 'gone',
    });
    assert.deepEqual(
      toErrorResponse(new ConduitError('RATE_LIMIT', 429, 'slow', 'RATE_LIMIT_EXCEEDED')),
      {
        name: 'RATE_LIMIT',
        status: 429,
        message: 'slow',
        conduitCode: 'RATE_LIMIT_EXCEEDED',
      },
    );
  });

  it('hides everything else behind an opaque 500', () => {
    const expected = {
      name: 'INTERNAL_SERVER_ERROR',
      status: 500,
      message: 'Something went wrong',
      conduitCode: 'INTERNAL_ERROR',
    };
    assert.deepEqual(toErrorResponse(new Error('secret driver text')), expected);
    assert.deepEqual(
      toErrorResponse(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })),
      expected,
    );
    assert.deepEqual(
      toErrorResponse(Object.assign(new Error('E11000 dup key'), { code: 11000 })),
      expected,
    );
    assert.deepEqual(
      toErrorResponse(Object.assign(new Error('mongo Unauthorized'), { code: 13 })),
      expected,
    );
    assert.deepEqual(toErrorResponse('Middleware does not exist'), expected);
    assert.deepEqual(toErrorResponse(undefined), expected);
  });

  it('carries the normalized error in the data of a socket connect error', () => {
    const err = toSocketConnectError(typed(16, 'TOKEN_INVALID', 'Invalid token'));
    assert.equal(err.message, 'Invalid token');
    assert.equal(err.data.conduitCode, 'TOKEN_INVALID');
    assert.equal(err.data.status, 401);
  });
});
