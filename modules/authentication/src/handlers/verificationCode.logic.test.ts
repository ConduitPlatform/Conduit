import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { consumeEmailVerificationCode } from './verificationCode.logic.js';

function memoryRedis() {
  const keys = new Map<string, string>();
  return {
    keys,
    async getDel(key: string) {
      await new Promise(resolve => setImmediate(resolve));
      const value = keys.get(key);
      if (value === undefined) return null;
      keys.delete(key);
      return value;
    },
  };
}

describe('consumeEmailVerificationCode', () => {
  it('lets exactly one of two concurrent GETDEL verifications succeed', async () => {
    const redis = memoryRedis();
    redis.keys.set('hash', '123456');
    const results = await Promise.allSettled([
      consumeEmailVerificationCode(key => redis.getDel(key), 'hash', '123456'),
      consumeEmailVerificationCode(key => redis.getDel(key), 'hash', '123456'),
    ]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    assert.equal(redis.keys.has('hash'), false);
  });

  it('rejects reuse after GETDEL', async () => {
    const redis = memoryRedis();
    redis.keys.set('hash', '123456');
    await consumeEmailVerificationCode(key => redis.getDel(key), 'hash', '123456');
    await assert.rejects(
      () => consumeEmailVerificationCode(key => redis.getDel(key), 'hash', '123456'),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        err.message === 'Invalid verification code',
    );
  });

  it('removes the key when the code does not match', async () => {
    const redis = memoryRedis();
    redis.keys.set('hash', '123456');
    await assert.rejects(
      () => consumeEmailVerificationCode(key => redis.getDel(key), 'hash', '000000'),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.equal(redis.keys.has('hash'), false);
    await assert.rejects(() =>
      consumeEmailVerificationCode(key => redis.getDel(key), 'hash', '123456'),
    );
  });
});
