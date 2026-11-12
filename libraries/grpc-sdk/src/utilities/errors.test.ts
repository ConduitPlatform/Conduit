import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  defineErrors,
  getConduitCode,
  grpcStatusToHttp,
  hasConduitCode,
  httpStatusToGrpc,
  isGrpcStatusError,
  parseErrorPayload,
} from './errors.ts';

const errors = defineErrors({
  FILE_NOT_FOUND: { grpcCode: 5, message: 'File does not exist', description: 'd' },
});

describe('defineErrors', () => {
  it('uses the key as conduitCode and freezes the catalog', () => {
    assert.equal(errors.FILE_NOT_FOUND.conduitCode, 'FILE_NOT_FOUND');
    assert.equal(errors.FILE_NOT_FOUND.grpcCode, 5);
    assert.ok(Object.isFrozen(errors) && Object.isFrozen(errors.FILE_NOT_FOUND));
  });

  it('rejects codes that are not SCREAMING_SNAKE_CASE', () => {
    assert.throws(() =>
      defineErrors({ notFound: { grpcCode: 5, message: 'm', description: 'd' } }),
    );
  });
});

describe('parseErrorPayload', () => {
  const json = JSON.stringify({ message: 'File does not exist', conduitCode: 'X' });

  it('reads a typed error before it crosses the wire (message)', () => {
    assert.deepEqual(parseErrorPayload({ code: 5, message: json }), {
      message: 'File does not exist',
      conduitCode: 'X',
    });
  });

  it('prefers details, which grpc-js leaves unprefixed', () => {
    const err = { code: 5, details: json, message: `5 NOT_FOUND: ${json}` };
    assert.equal(getConduitCode(err), 'X');
    assert.ok(hasConduitCode(err, 'X'));
    assert.ok(hasConduitCode(err, { conduitCode: 'X' }));
    assert.ok(!hasConduitCode(err, errors.FILE_NOT_FOUND));
  });

  it('returns plain text untouched', () => {
    assert.deepEqual(parseErrorPayload({ code: 5, details: 'nope' }), {
      message: 'nope',
    });
    assert.deepEqual(parseErrorPayload({ details: '{"other":1}' }), {
      message: '{"other":1}',
    });
    assert.deepEqual(parseErrorPayload('text'), { message: 'text' });
    assert.deepEqual(parseErrorPayload(undefined), { message: '' });
  });
});

describe('isGrpcStatusError', () => {
  it('accepts branded errors and service errors', () => {
    assert.ok(isGrpcStatusError({ code: 5, isGrpcError: true }));
    assert.ok(isGrpcStatusError({ code: 14, details: 'down' }));
  });

  it('rejects driver errors with a numeric or string code', () => {
    assert.ok(!isGrpcStatusError({ code: 11000, message: 'E11000 duplicate key' }));
    assert.ok(!isGrpcStatusError({ code: 13, message: 'mongo Unauthorized' }));
    assert.ok(!isGrpcStatusError({ code: 'ECONNREFUSED' }));
    assert.ok(!isGrpcStatusError(null));
  });
});

describe('status mapping', () => {
  it('serves every gRPC status with a matching HTTP status', () => {
    const expected: Record<number, number> = {
      3: 400,
      4: 504,
      5: 404,
      6: 409,
      7: 403,
      8: 429,
      9: 412,
      10: 409,
      11: 400,
      12: 501,
      13: 500,
      14: 503,
      16: 401,
    };
    for (const [code, http] of Object.entries(expected)) {
      assert.equal(grpcStatusToHttp(Number(code)).status, http, `grpc ${code}`);
    }
  });

  it('round-trips the HTTP statuses a ConduitError uses', () => {
    for (const http of [400, 401, 403, 404, 409, 412, 429, 501, 503, 504]) {
      assert.equal(grpcStatusToHttp(httpStatusToGrpc(http)).status, http);
    }
    assert.equal(httpStatusToGrpc(500), 13);
  });
});
