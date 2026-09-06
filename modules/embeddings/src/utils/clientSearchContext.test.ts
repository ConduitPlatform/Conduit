import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  assertClientSearchSubject,
  clampClientSearchLimit,
  clientSearchSubject,
  CLIENT_SEMANTIC_SEARCH_MAX_LIMIT,
} from './clientSearchContext.js';

describe('client semantic search context', () => {
  it('accepts text-only search subjects from router context and fail-closes otherwise', () => {
    assert.deepEqual(
      clientSearchSubject({ user: { _id: 'user-1' }, scope: 'Team:org' }),
      {
        userId: 'user-1',
        scope: 'Team:org',
      },
    );
    assert.deepEqual(clientSearchSubject({ user: { _id: 1 } }), {});
    assert.throws(
      () => assertClientSearchSubject(clientSearchSubject({})),
      (err: unknown) => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
    assert.doesNotThrow(() =>
      assertClientSearchSubject(clientSearchSubject({ user: { _id: 'user-1' } })),
    );
  });

  it('caps client semantic-search limit below the admin/gRPC maximum', () => {
    assert.equal(clampClientSearchLimit(undefined), undefined);
    assert.equal(clampClientSearchLimit(10), 10);
    assert.equal(clampClientSearchLimit(1000), CLIENT_SEMANTIC_SEARCH_MAX_LIMIT);
    assert.equal(CLIENT_SEMANTIC_SEARCH_MAX_LIMIT, 50);
    assert.throws(
      () => clampClientSearchLimit(0),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
  });
});
