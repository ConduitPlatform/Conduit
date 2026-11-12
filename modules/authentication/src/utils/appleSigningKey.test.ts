import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { getConduitCode, GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { errors } from '../errors.js';
import { mapJwksSigningKeyError, resolveAppleSigningKey } from './appleSigningKey.js';

function appleToken(kid?: string) {
  const { privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return jwt.sign(
    {
      iss: 'https://appleid.apple.com',
      aud: 'com.example.app',
      sub: 'apple-user',
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    privateKey,
    {
      algorithm: 'ES256',
      ...(kid ? { keyid: kid } : {}),
    },
  );
}

function isGrpc(err: unknown, code: status, definition: { conduitCode: string }) {
  return (
    err instanceof GrpcError &&
    err.code === code &&
    getConduitCode(err) === definition.conduitCode
  );
}

describe('mapJwksSigningKeyError', () => {
  it('maps SigningKeyNotFoundError to Invalid token', () => {
    const err = mapJwksSigningKeyError(new jwksRsa.SigningKeyNotFoundError('missing'));
    assert.equal(err.code, status.INVALID_ARGUMENT);
    assert.equal(getConduitCode(err), errors.APPLE_TOKEN_INVALID.conduitCode);
  });

  it('maps a name-only SigningKeyNotFoundError to Invalid token', () => {
    const err = mapJwksSigningKeyError(
      Object.assign(new Error('missing'), { name: 'SigningKeyNotFoundError' }),
    );
    assert.equal(err.code, status.INVALID_ARGUMENT);
    assert.equal(getConduitCode(err), errors.APPLE_TOKEN_INVALID.conduitCode);
  });

  it('maps JwksError to UNAVAILABLE', () => {
    const err = mapJwksSigningKeyError(new jwksRsa.JwksError('fetch failed'));
    assert.equal(err.code, status.UNAVAILABLE);
    assert.equal(getConduitCode(err), errors.APPLE_KEYS_UNAVAILABLE.conduitCode);
  });

  it('maps JwksRateLimitError to UNAVAILABLE', () => {
    const err = mapJwksSigningKeyError(new jwksRsa.JwksRateLimitError('slow down'));
    assert.equal(err.code, status.UNAVAILABLE);
    assert.equal(getConduitCode(err), errors.APPLE_KEYS_UNAVAILABLE.conduitCode);
  });

  it('maps generic network errors to UNAVAILABLE', () => {
    const err = mapJwksSigningKeyError(new Error('ECONNREFUSED'));
    assert.equal(err.code, status.UNAVAILABLE);
    assert.equal(getConduitCode(err), errors.APPLE_KEYS_UNAVAILABLE.conduitCode);
  });
});

describe('resolveAppleSigningKey', () => {
  it('rejects a token without kid', async () => {
    await assert.rejects(
      () =>
        resolveAppleSigningKey(appleToken(), async () => ({ getPublicKey: () => '' })),
      (err: unknown) => isGrpc(err, status.INVALID_ARGUMENT, errors.APPLE_TOKEN_INVALID),
    );
  });

  it('rejects a malformed token', async () => {
    await assert.rejects(
      () => resolveAppleSigningKey('not.a.jwt', async () => ({ getPublicKey: () => '' })),
      (err: unknown) => isGrpc(err, status.INVALID_ARGUMENT, errors.APPLE_TOKEN_INVALID),
    );
  });

  it('rejects an unknown kid', async () => {
    await assert.rejects(
      () =>
        resolveAppleSigningKey(appleToken('unknown'), async () => {
          throw new jwksRsa.SigningKeyNotFoundError('no match');
        }),
      (err: unknown) => isGrpc(err, status.INVALID_ARGUMENT, errors.APPLE_TOKEN_INVALID),
    );
  });

  it('maps JWKS transport failure to UNAVAILABLE', async () => {
    await assert.rejects(
      () =>
        resolveAppleSigningKey(appleToken('known'), async () => {
          throw new jwksRsa.JwksError('503');
        }),
      (err: unknown) => isGrpc(err, status.UNAVAILABLE, errors.APPLE_KEYS_UNAVAILABLE),
    );
  });

  it('returns the PEM on success', async () => {
    const pem = '-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----';
    const result = await resolveAppleSigningKey(appleToken('known'), async kid => {
      assert.equal(kid, 'known');
      return { getPublicKey: () => pem };
    });
    assert.equal(result, pem);
  });
});
