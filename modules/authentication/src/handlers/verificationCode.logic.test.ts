import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  consumeEmailVerificationCode,
  EMAIL_CODE_MAX_ATTEMPTS,
  emailCodeKeys,
} from './verificationCode.logic.js';

describe('emailCodeKeys', () => {
  it('puts the code and attempt keys under one hash tag', () => {
    const { codeKey, attemptsKey } = emailCodeKeys('user@example.com');
    assert.match(codeKey, /^\{[0-9a-f]{64}\}$/);
    assert.equal(attemptsKey, `${codeKey}:attempts`);
    assert.notEqual(emailCodeKeys('other@example.com').codeKey, codeKey);
  });
});

describe('consumeEmailVerificationCode', () => {
  it('passes the keys, code and attempt limit to the state store', async () => {
    const calls: unknown[][] = [];
    await consumeEmailVerificationCode(
      async (...args) => {
        calls.push(args);
        return true;
      },
      'user@example.com',
      '123456',
    );
    const { codeKey, attemptsKey } = emailCodeKeys('user@example.com');
    assert.deepEqual(calls, [[codeKey, attemptsKey, '123456', EMAIL_CODE_MAX_ATTEMPTS]]);
    assert.equal(EMAIL_CODE_MAX_ATTEMPTS, 5);
  });

  it('rejects a code the state store does not consume', async () => {
    await assert.rejects(
      () => consumeEmailVerificationCode(async () => false, 'user@example.com', '000000'),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        err.message === 'Invalid verification code',
    );
  });
});
