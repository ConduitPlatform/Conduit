import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
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

function isGrpc(err: unknown, code: status, message: string) {
  return err instanceof GrpcError && err.code === code && err.message === message;
}

describe('mapJwksSigningKeyError', () => {
  it('maps SigningKeyNotFoundError to Invalid token', () => {
    const err = mapJwksSigningKeyError(new jwksRsa.SigningKeyNotFoundError('missing'));
    assert.equal(err.code, status.INVALID_ARGUMENT);
    assert.equal(err.message, 'Invalid token');
  });

  it('maps a name-only SigningKeyNotFoundError to Invalid token', () => {
    const err = mapJwksSigningKeyError(
      Object.assign(new Error('missing'), { name: 'SigningKeyNotFoundError' }),
    );
    assert.equal(err.code, status.INVALID_ARGUMENT);
    assert.equal(err.message, 'Invalid token');
  });

  it('maps JwksError to UNAVAILABLE', () => {
    const err = mapJwksSigningKeyError(new jwksRsa.JwksError('fetch failed'));
    assert.equal(err.code, status.UNAVAILABLE);
    assert.equal(err.message, 'Unable to verify identity token');
  });

  it('maps JwksRateLimitError to UNAVAILABLE', () => {
    const err = mapJwksSigningKeyError(new jwksRsa.JwksRateLimitError('slow down'));
    assert.equal(err.code, status.UNAVAILABLE);
    assert.equal(err.message, 'Unable to verify identity token');
  });

  it('maps generic network errors to UNAVAILABLE', () => {
    const err = mapJwksSigningKeyError(new Error('ECONNREFUSED'));
    assert.equal(err.code, status.UNAVAILABLE);
    assert.equal(err.message, 'Unable to verify identity token');
  });
});

describe('resolveAppleSigningKey', () => {
  it('rejects a token without kid', async () => {
    await assert.rejects(
      () =>
        resolveAppleSigningKey(appleToken(), async () => ({ getPublicKey: () => '' })),
      (err: unknown) => isGrpc(err, status.INVALID_ARGUMENT, 'Invalid token'),
    );
  });

  it('rejects a malformed token', async () => {
    await assert.rejects(
      () => resolveAppleSigningKey('not.a.jwt', async () => ({ getPublicKey: () => '' })),
      (err: unknown) => isGrpc(err, status.INVALID_ARGUMENT, 'Invalid token'),
    );
  });

  it('rejects an unknown kid', async () => {
    await assert.rejects(
      () =>
        resolveAppleSigningKey(appleToken('unknown'), async () => {
          throw new jwksRsa.SigningKeyNotFoundError('no match');
        }),
      (err: unknown) => isGrpc(err, status.INVALID_ARGUMENT, 'Invalid token'),
    );
  });

  it('maps JWKS transport failure to UNAVAILABLE', async () => {
    await assert.rejects(
      () =>
        resolveAppleSigningKey(appleToken('known'), async () => {
          throw new jwksRsa.JwksError('503');
        }),
      (err: unknown) =>
        isGrpc(err, status.UNAVAILABLE, 'Unable to verify identity token'),
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
