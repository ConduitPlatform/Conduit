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
  it('forwards the token user id and an optional query scope', () => {
    assert.deepEqual(
      clientSearchSubject({
        context: { user: { _id: 'user-1' }, scope: 'Team:ignored' },
        queryParams: { scope: 'Team:org' },
      }),
      { userId: 'user-1', scope: 'Team:org' },
    );
    assert.deepEqual(clientSearchSubject({ context: { user: { _id: 'user-1' } } }), {
      userId: 'user-1',
    });
    assert.deepEqual(
      assertClientSearchSubject(
        clientSearchSubject({
          context: { user: { _id: 'user-1' } },
          queryParams: { scope: 'Team:org' },
        }),
      ),
      { userId: 'user-1', scope: 'Team:org' },
    );
  });

  it('ignores router context scope and treats empty or non-string scope as absent', () => {
    assert.deepEqual(
      clientSearchSubject({
        context: { user: { _id: 'user-1' }, scope: 'Team:context' },
        queryParams: {},
      }),
      { userId: 'user-1' },
    );
    assert.deepEqual(
      clientSearchSubject({
        context: { user: { _id: 'user-1' } },
        queryParams: { scope: '' },
      }),
      { userId: 'user-1' },
    );
    assert.deepEqual(
      clientSearchSubject({
        context: { user: { _id: 'user-1' } },
        queryParams: { scope: ['Team:a', 'Team:b'] },
      }),
      { userId: 'user-1' },
    );
    assert.deepEqual(clientSearchSubject({ context: { user: { _id: 1 } } }), {});
  });

  it('rejects a missing token user even when scope is set', () => {
    assert.throws(
      () =>
        assertClientSearchSubject(
          clientSearchSubject({
            context: { scope: 'Team:org' },
            queryParams: { scope: 'Team:org' },
          }),
        ),
      (err: unknown) => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
    assert.throws(
      () => assertClientSearchSubject(clientSearchSubject({})),
      (err: unknown) => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
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
