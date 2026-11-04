import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  emptySigning,
  ensureSigning,
  generateSigningKeypair,
  isSigningEmpty,
  keyIdOf,
  previousKeyActive,
  rotate,
} from './signingKeys.logic.js';

describe('generateSigningKeypair', () => {
  it('produces a usable PEM Ed25519 keypair with a stable kid', () => {
    const pair = generateSigningKeypair();
    assert.match(pair.publicKey, /BEGIN PUBLIC KEY/);
    assert.match(pair.privateKey, /BEGIN PRIVATE KEY/);
    assert.equal(pair.kid, keyIdOf(pair.publicKey));
    const sig = crypto.sign(null, Buffer.from('x'), pair.privateKey);
    assert.equal(crypto.verify(null, Buffer.from('x'), pair.publicKey, sig), true);
  });
  it('mints distinct keys each time', () => {
    assert.notEqual(generateSigningKeypair().kid, generateSigningKeypair().kid);
  });
});

describe('isSigningEmpty', () => {
  it('is empty for missing or blank current keys', () => {
    assert.equal(isSigningEmpty(undefined), true);
    assert.equal(isSigningEmpty(emptySigning()), true);
    assert.equal(isSigningEmpty({ ...generateSigningKeypair(), privateKey: ' ' }), true);
  });
  it('is not empty with a full keypair', () => {
    assert.equal(isSigningEmpty(generateSigningKeypair()), false);
  });
});

describe('ensureSigning', () => {
  it('fills an empty block and keeps a present one', () => {
    const filled = ensureSigning(emptySigning());
    assert.equal(isSigningEmpty(filled), false);
    assert.deepEqual(ensureSigning(filled), filled);
  });
});

describe('rotate', () => {
  it('moves current to previous with an absolute retire timestamp', () => {
    const start = ensureSigning(emptySigning());
    const now = 1_000_000;
    const next = rotate(start, now, 60_000);
    assert.notEqual(next.kid, start.kid);
    assert.equal(next.previousKid, start.kid);
    assert.equal(next.previousPublicKey, start.publicKey);
    assert.equal(next.previousRetiredAt, now + 120_000);
    assert.equal(isSigningEmpty(next), false);
  });
  it('mints without a previous key when there is no current one', () => {
    const next = rotate(emptySigning(), 5, 60_000);
    assert.equal(next.previousKid, '');
    assert.equal(next.previousRetiredAt, 0);
    assert.equal(isSigningEmpty(next), false);
  });
  it('does not mutate its input', () => {
    const start = ensureSigning(emptySigning());
    const copy = { ...start };
    rotate(start, 1, 1000);
    assert.deepEqual(start, copy);
  });
});

describe('previousKeyActive', () => {
  it('is active only before the retire timestamp', () => {
    const next = rotate(ensureSigning(emptySigning()), 1000, 500);
    assert.equal(previousKeyActive(next, 1999), true);
    assert.equal(previousKeyActive(next, 2000), false);
    assert.equal(previousKeyActive(emptySigning(), 0), false);
  });
});
