import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  effectiveMaxExpiresOn,
  extendRefreshToken,
  hashRefreshToken,
  initialRefreshExpiry,
  refreshMaxExpiresOn,
} from './refreshToken.logic.js';

describe('hashRefreshToken', () => {
  it('is a deterministic sha256 hex digest', () => {
    assert.equal(
      hashRefreshToken('abc'),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    assert.notEqual(hashRefreshToken('a'), hashRefreshToken('b'));
  });
});

describe('extendRefreshToken', () => {
  const now = new Date('2026-01-10T00:00:00Z');
  it('extends to now + expiryPeriod below the cap', () => {
    const r = extendRefreshToken({
      now,
      expiryPeriod: 1000,
      maxExpiresOn: new Date(now.getTime() + 5000),
      extendable: true,
    });
    assert.deepEqual(r, { ok: true, expiresOn: new Date(now.getTime() + 1000) });
  });
  it('clamps to maxExpiresOn', () => {
    const cap = new Date(now.getTime() + 500);
    const r = extendRefreshToken({
      now,
      expiryPeriod: 1000,
      maxExpiresOn: cap,
      extendable: true,
    });
    assert.deepEqual(r, { ok: true, expiresOn: cap });
  });
  it('accepts numeric timestamps', () => {
    const r = extendRefreshToken({
      now: 0,
      expiryPeriod: 10,
      maxExpiresOn: 100,
      extendable: true,
    });
    assert.deepEqual(r, { ok: true, expiresOn: new Date(10) });
  });
  it('refuses a non-extendable token', () => {
    const r = extendRefreshToken({
      now,
      expiryPeriod: 1000,
      maxExpiresOn: new Date(now.getTime() + 5000),
      extendable: false,
    });
    assert.deepEqual(r, { ok: false, reason: 'NOT_EXTENDABLE' });
  });
});

describe('refresh issue helpers', () => {
  it('computes the cap and a capped initial expiry', () => {
    assert.equal(refreshMaxExpiresOn(1000, 500).getTime(), 1500);
    assert.equal(initialRefreshExpiry(0, 100, 500).getTime(), 100);
    assert.equal(initialRefreshExpiry(0, 900, 500).getTime(), 500);
  });
});

describe('effectiveMaxExpiresOn', () => {
  it('honors a policy tightened after mint', () => {
    const row = { issuedAt: 0, maxExpiresOn: 1000, expiresOn: 10 };
    assert.equal(effectiveMaxExpiresOn(row, 5000).getTime(), 1000);
    assert.equal(effectiveMaxExpiresOn(row, 400).getTime(), 400);
  });
  it('falls back for legacy rows', () => {
    assert.equal(effectiveMaxExpiresOn({ expiresOn: 77 }, 5).getTime(), 77);
    assert.equal(
      effectiveMaxExpiresOn({ maxExpiresOn: 90, expiresOn: 77 }, 5).getTime(),
      90,
    );
  });
});
