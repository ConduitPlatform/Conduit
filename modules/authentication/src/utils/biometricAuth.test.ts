import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import {
  BIOMETRIC_CHALLENGE_TTL_MS,
  consumeOnce,
  isBiometricChallengeExpired,
  verifyBiometricSignature,
} from './biometricAuth.js';

function generateKeyPair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });
}

function signChallenge(privateKeyDer: Buffer, challenge: string): string {
  const signer = crypto.createSign('sha256WithRSAEncryption');
  signer.update(new Uint8Array(Buffer.from(challenge)));
  return signer.sign(
    crypto.createPrivateKey({ key: privateKeyDer, format: 'der', type: 'pkcs8' }),
    'base64',
  );
}

describe('isBiometricChallengeExpired', () => {
  it('accepts a fresh challenge', () => {
    assert.equal(isBiometricChallengeExpired(new Date(), Date.now()), false);
  });

  it('rejects a challenge older than the TTL', () => {
    const createdAt = new Date(Date.now() - BIOMETRIC_CHALLENGE_TTL_MS - 1);
    assert.equal(isBiometricChallengeExpired(createdAt), true);
  });
});

describe('verifyBiometricSignature', () => {
  it('accepts a signature over the challenge (happy path)', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const challenge = crypto.randomBytes(64).toString('hex');
    const signature = signChallenge(privateKey, challenge);
    assert.equal(
      verifyBiometricSignature(publicKey.toString('base64'), challenge, signature),
      true,
    );
  });

  it('rejects a signature over a different payload (replay of user._id style)', () => {
    const { publicKey, privateKey } = generateKeyPair();
    const challenge = crypto.randomBytes(64).toString('hex');
    const signature = signChallenge(privateKey, 'user-id-instead-of-challenge');
    assert.equal(
      verifyBiometricSignature(publicKey.toString('base64'), challenge, signature),
      false,
    );
  });
});

describe('atomic biometric token consume', () => {
  it('replays fail after the token is consumed', () => {
    const store = { value: { challenge: 'once' } };
    assert.deepEqual(consumeOnce(store), { challenge: 'once' });
    assert.equal(consumeOnce(store), null);
    assert.equal(consumeOnce(store), null);
  });

  it('only one concurrent consumer wins a double-spend', async () => {
    const store = { value: { token: 'login-challenge' } };
    const [first, second] = await Promise.all([
      Promise.resolve(consumeOnce(store)),
      Promise.resolve(consumeOnce(store)),
    ]);
    const winners = [first, second].filter(value => value !== null);
    assert.equal(winners.length, 1);
    assert.deepEqual(winners[0], { token: 'login-challenge' });
  });

  it('treats a clientId mismatch as a failed bind after consume', () => {
    const store = {
      value: { data: { clientId: 'web', challenge: 'c' } },
    };
    const consumed = consumeOnce(store);
    assert.ok(consumed);
    assert.notEqual(consumed.data.clientId, 'mobile');
    assert.equal(consumeOnce(store), null);
  });
});
