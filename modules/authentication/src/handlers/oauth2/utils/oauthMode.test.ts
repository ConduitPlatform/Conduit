import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import { errors } from '../../../errors.js';
import {
  assertOAuthRegistrationAllowed,
  isRegistrationNotAllowedError,
  redirectOnRegistrationNotAllowed,
  resolveOAuthMode,
} from './oauthMode.js';

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

  it('allows signIn registration when an invitation token is present', () => {
    assert.doesNotThrow(() => assertOAuthRegistrationAllowed('signIn', 'invite-token'));
  });

  it('still blocks signIn when the invitation token is empty or whitespace', () => {
    assert.throws(
      () => assertOAuthRegistrationAllowed('signIn', ''),
      (err: unknown) => err instanceof ModuleError,
    );
    assert.throws(
      () => assertOAuthRegistrationAllowed('signIn', '   '),
      (err: unknown) => err instanceof ModuleError,
    );
  });
});

describe('redirectOnRegistrationNotAllowed', () => {
  it('appends conduitCode on the app redirect for REGISTRATION_NOT_ALLOWED', () => {
    const err = new ModuleError(errors.REGISTRATION_NOT_ALLOWED);
    assert.deepEqual(redirectOnRegistrationNotAllowed(err, 'https://app.example/oauth'), {
      redirect: 'https://app.example/oauth?conduitCode=REGISTRATION_NOT_ALLOWED',
    });
  });

  it('preserves existing query params on the redirect', () => {
    const err = new ModuleError(errors.REGISTRATION_NOT_ALLOWED);
    assert.deepEqual(
      redirectOnRegistrationNotAllowed(err, 'https://app.example/oauth?from=login'),
      {
        redirect:
          'https://app.example/oauth?from=login&conduitCode=REGISTRATION_NOT_ALLOWED',
      },
    );
  });

  it('rethrows when the error is not REGISTRATION_NOT_ALLOWED', () => {
    const err = new GrpcError(status.NOT_FOUND, 'missing');
    assert.throws(
      () => redirectOnRegistrationNotAllowed(err, 'https://app.example/oauth'),
      (thrown: unknown) => thrown === err,
    );
  });

  it('rethrows when there is no redirect URI', () => {
    const err = new ModuleError(errors.REGISTRATION_NOT_ALLOWED);
    assert.throws(
      () => redirectOnRegistrationNotAllowed(err),
      (thrown: unknown) => thrown === err,
    );
  });

  it('rethrows when the redirect URI is not a valid absolute URL', () => {
    const err = new ModuleError(errors.REGISTRATION_NOT_ALLOWED);
    assert.throws(
      () => redirectOnRegistrationNotAllowed(err, '/relative'),
      (thrown: unknown) => thrown === err,
    );
  });

  it('identifies ModuleError REGISTRATION_NOT_ALLOWED payloads', () => {
    assert.equal(
      isRegistrationNotAllowedError(new ModuleError(errors.REGISTRATION_NOT_ALLOWED)),
      true,
    );
    assert.equal(isRegistrationNotAllowedError(new Error('nope')), false);
  });
});
