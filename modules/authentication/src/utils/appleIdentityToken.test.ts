import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { verifyAppleIdentityToken } from './appleIdentityToken.js';

function ecKeyPair() {
  return crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

function appleToken(
  privateKey: string,
  aud: string,
  algorithm: jwt.Algorithm = 'ES256',
) {
  return jwt.sign(
    {
      iss: 'https://appleid.apple.com',
      aud,
      sub: 'apple-user',
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    privateKey,
    { algorithm },
  );
}

describe('verifyAppleIdentityToken', () => {
  it('rejects tokens signed with HS256 instead of ES256', () => {
    const token = jwt.sign(
      {
        iss: 'https://appleid.apple.com',
        aud: 'com.example.app',
        sub: 'apple-user',
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      'not-an-apple-key',
      { algorithm: 'HS256' },
    );
    assert.throws(
      () =>
        verifyAppleIdentityToken(
          '-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----',
          token,
          'com.example.app',
        ),
      (err: Error) => err.message === 'Invalid token',
    );
  });

  it('accepts an ES256 token whose aud matches the resolved OAuth clientId', () => {
    const { publicKey, privateKey } = ecKeyPair();
    const token = appleToken(privateKey, 'com.example.secondary');
    const payload = verifyAppleIdentityToken(publicKey, token, [
      'com.example.app',
      'com.example.secondary',
    ]);
    assert.equal(payload.sub, 'apple-user');
    assert.equal(payload.aud, 'com.example.secondary');
  });

  it('rejects an ES256 token whose aud is not the resolved clientId', () => {
    const { publicKey, privateKey } = ecKeyPair();
    const token = appleToken(privateKey, 'com.example.attacker');
    assert.throws(
      () => verifyAppleIdentityToken(publicKey, token, 'com.example.secondary'),
      (err: Error) => err.message === 'Invalid token',
    );
  });
});
