import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isTotpReplay,
  lockStatus,
  parseFailureRecord,
  planSudo,
  registerFailure,
  SUDO_LOCK_MS,
  SUDO_MAX_FAILURES,
  totpStep,
} from './sudo.logic.js';

const plain = { hasTwoFA: false, hasPassword: true };
const totp = { hasTwoFA: true, twoFaMethod: 'authenticator', hasPassword: true };
const sms = { hasTwoFA: true, twoFaMethod: 'sms', hasPassword: true };

describe('planSudo', () => {
  it('no 2FA: password only', () => {
    assert.deepEqual(planSudo(plain, { password: 'x' }), {
      action: 'verify',
      verifyPassword: true,
      verifyTotp: false,
      verifySms: false,
    });
    assert.deepEqual(planSudo(plain, {}), {
      action: 'reject',
      reason: 'MISSING_CREDENTIALS',
    });
    assert.deepEqual(planSudo(plain, { code: '123456' }), {
      action: 'reject',
      reason: 'MISSING_CREDENTIALS',
    });
    assert.deepEqual(planSudo({ ...plain, hasPassword: false }, { password: 'x' }), {
      action: 'reject',
      reason: 'NO_PASSWORD',
    });
  });
  it('authenticator: a password alone is never enough', () => {
    assert.deepEqual(planSudo(totp, { password: 'x' }), {
      action: 'reject',
      reason: 'CODE_REQUIRED',
    });
    assert.deepEqual(planSudo(totp, { code: '1' }), {
      action: 'verify',
      verifyPassword: false,
      verifyTotp: true,
      verifySms: false,
    });
    assert.deepEqual(planSudo(totp, { code: '1', password: 'x' }), {
      action: 'verify',
      verifyPassword: true,
      verifyTotp: true,
      verifySms: false,
    });
    assert.deepEqual(
      planSudo({ ...totp, hasPassword: false }, { code: '1', password: 'x' }),
      {
        action: 'reject',
        reason: 'NO_PASSWORD',
      },
    );
  });
  it('sms: challenge without a code, verify with one', () => {
    assert.deepEqual(planSudo(sms, {}), {
      action: 'sms_challenge',
      verifyPassword: false,
    });
    assert.deepEqual(planSudo(sms, { password: 'x' }), {
      action: 'sms_challenge',
      verifyPassword: true,
    });
    assert.deepEqual(planSudo({ ...sms, twoFaMethod: 'phone' }, { code: '1' }), {
      action: 'verify',
      verifyPassword: false,
      verifyTotp: false,
      verifySms: true,
    });
  });
  it('unknown 2FA method is refused', () => {
    assert.deepEqual(planSudo({ ...totp, twoFaMethod: 'x' }, { code: '1' }), {
      action: 'reject',
      reason: 'UNSUPPORTED_2FA',
    });
  });
});

describe('failure lockout', () => {
  it('locks on the fifth failure for 15 minutes', () => {
    let rec = parseFailureRecord(null);
    for (let i = 1; i < SUDO_MAX_FAILURES; i++) {
      rec = registerFailure(rec, 1000);
      assert.equal(lockStatus(rec, 1000).locked, false);
    }
    rec = registerFailure(rec, 1000);
    assert.deepEqual(lockStatus(rec, 1000), { locked: true, retryAfterMs: SUDO_LOCK_MS });
    assert.equal(lockStatus(rec, 1000 + SUDO_LOCK_MS).locked, false);
  });
  it('an expired lock counts afresh', () => {
    const rec = registerFailure({ failures: 5, lockedUntil: 10 }, 20);
    assert.deepEqual(rec, { failures: 1, lockedUntil: 0 });
  });
  it('parses garbage as empty', () => {
    assert.deepEqual(parseFailureRecord('{bad'), { failures: 0, lockedUntil: 0 });
    assert.deepEqual(parseFailureRecord('{"failures":2,"lockedUntil":5}'), {
      failures: 2,
      lockedUntil: 5,
    });
  });
});

describe('totp replay', () => {
  it('step arithmetic and replay detection', () => {
    assert.equal(totpStep(60_000, 0), 2);
    assert.equal(totpStep(60_000, -1), 1);
    assert.equal(isTotpReplay(null, 2), false);
    assert.equal(isTotpReplay(2, 2), true);
    assert.equal(isTotpReplay(2, 1), true);
    assert.equal(isTotpReplay(2, 3), false);
  });
});
