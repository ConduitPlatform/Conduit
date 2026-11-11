import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertGrpcKeyRequirement } from './productionSecurity.js';

describe('production GRPC_KEY requirement', () => {
  it('requires GRPC_KEY when NODE_ENV is production', () => {
    assert.throws(
      () => assertGrpcKeyRequirement({ NODE_ENV: 'production' }),
      /GRPC_KEY is required/,
    );
    assert.doesNotThrow(() =>
      assertGrpcKeyRequirement({ NODE_ENV: 'production', GRPC_KEY: 'secret' }),
    );
  });

  it('does not require GRPC_KEY outside production', () => {
    assert.doesNotThrow(() => assertGrpcKeyRequirement({ NODE_ENV: 'test' }));
    assert.doesNotThrow(() => assertGrpcKeyRequirement({ NODE_ENV: 'development' }));
  });
});
