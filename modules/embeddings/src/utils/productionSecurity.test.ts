import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { assertGrpcKeyRequirement } from './productionSecurity.js';

describe('production GRPC_KEY requirement', () => {
  it('requires GRPC_KEY when NODE_ENV is production', () => {
    assert.throws(
      () => assertGrpcKeyRequirement({ NODE_ENV: 'production' }),
      err => err instanceof GrpcError && err.code === status.FAILED_PRECONDITION,
    );
    assert.doesNotThrow(() =>
      assertGrpcKeyRequirement({ NODE_ENV: 'production', GRPC_KEY: 'secret' }),
    );
  });

  it('does not require GRPC_KEY in non-production unless configured', () => {
    assert.doesNotThrow(() => assertGrpcKeyRequirement({ NODE_ENV: 'test' }));
    assert.throws(
      () =>
        assertGrpcKeyRequirement(
          { NODE_ENV: 'development' },
          { security: { requireGrpcKey: true } },
        ),
      err => err instanceof GrpcError && err.code === status.FAILED_PRECONDITION,
    );
  });
});
