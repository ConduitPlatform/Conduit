import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { errors } from '../../../errors.js';
import { assertOAuthRegistrationAllowed, resolveOAuthMode } from './oauthMode.js';

describe('resolveOAuthMode', () => {
  it('defaults to both when the value is omitted', () => {
    assert.equal(resolveOAuthMode(undefined), 'both');
    assert.equal(resolveOAuthMode(null), 'both');
    assert.equal(resolveOAuthMode(''), 'both');
  });

  it('returns both when both is provided', () => {
    assert.equal(resolveOAuthMode('both'), 'both');
  });

  it('returns signIn when signIn is provided', () => {
    assert.equal(resolveOAuthMode('signIn'), 'signIn');
  });

  it('throws INVALID_ARGUMENT for an invalid value', () => {
    assert.throws(
      () => resolveOAuthMode('register'),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        err.message.includes('mode must be "signIn" or "both"'),
    );
  });

  it('caps to signIn when provider registration is disabled', () => {
    assert.equal(resolveOAuthMode(undefined, false), 'signIn');
    assert.equal(resolveOAuthMode('both', false), 'signIn');
    assert.equal(resolveOAuthMode('signIn', false), 'signIn');
  });

  it('still rejects invalid values when registration is disabled', () => {
    assert.throws(
      () => resolveOAuthMode('register', false),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
  });
});

describe('assertOAuthRegistrationAllowed', () => {
  it('allows registration when mode is both', () => {
    assert.doesNotThrow(() => assertOAuthRegistrationAllowed('both'));
  });

  it('throws REGISTRATION_NOT_ALLOWED when mode is signIn', () => {
    assert.throws(
      () => assertOAuthRegistrationAllowed('signIn'),
      (err: unknown) => {
        if (!(err instanceof ModuleError) || err.code !== status.PERMISSION_DENIED) {
          return false;
        }
        const parsed = JSON.parse(err.message) as {
          conduitCode: string;
          message: string;
        };
        return (
          parsed.conduitCode === errors.REGISTRATION_NOT_ALLOWED.conduitCode &&
          parsed.message === errors.REGISTRATION_NOT_ALLOWED.message
        );
      },
    );
  });
});
