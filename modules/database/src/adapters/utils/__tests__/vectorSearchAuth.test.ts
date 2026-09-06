import { describe, expect, it } from '@jest/globals';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  assertVectorSearchAccess,
  resolveAdminOperatorContext,
} from '../vectorSearchAuth.js';

describe('vector search authorization', () => {
  it('allows unscoped search when authorization is disabled', () => {
    expect(() =>
      assertVectorSearchAccess({
        authzEnabled: false,
      }),
    ).not.toThrow();
  });

  it('fails closed on authorization-enabled schemas without subject, scope, or admin operator', () => {
    try {
      assertVectorSearchAccess({ authzEnabled: true });
      throw new Error('expected failure');
    } catch (err) {
      expect(err).toBeInstanceOf(GrpcError);
      expect((err as GrpcError).code).toBe(status.PERMISSION_DENIED);
    }
  });

  it('allows a subject or scope on authorization-enabled schemas', () => {
    expect(() =>
      assertVectorSearchAccess({ authzEnabled: true, userId: 'user-1' }),
    ).not.toThrow();
    expect(() =>
      assertVectorSearchAccess({ authzEnabled: true, scope: 'Team:org' }),
    ).not.toThrow();
  });

  it('allows an explicit admin operator context', () => {
    expect(() =>
      assertVectorSearchAccess({ authzEnabled: true, adminOperator: true }),
    ).not.toThrow();
  });

  it('only honors adminOperator from verified platform operator modules', () => {
    expect(
      resolveAdminOperatorContext({ requested: true, callerModule: 'database' }),
    ).toBe(true);
    expect(resolveAdminOperatorContext({ requested: true, callerModule: 'core' })).toBe(
      true,
    );
    expect(
      resolveAdminOperatorContext({ requested: true, callerModule: 'embeddings' }),
    ).toBe(true);
    expect(resolveAdminOperatorContext({ requested: false, callerModule: 'chat' })).toBe(
      false,
    );
    try {
      resolveAdminOperatorContext({ requested: true, callerModule: 'chat' });
      throw new Error('expected failure');
    } catch (err) {
      expect((err as GrpcError).code).toBe(status.PERMISSION_DENIED);
    }
  });
});
