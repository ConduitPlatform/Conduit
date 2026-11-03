/*
 * Pure decisions of the /sudo step-up route: which proofs a user must present, the
 * failed-attempt lockout and TOTP replay protection. No IO.
 */

export const SUDO_MAX_FAILURES = 5;
export const SUDO_LOCK_MS = 15 * 60_000;
export const TOTP_REPLAY_MS = 90_000;
export const TOTP_STEP_MS = 30_000;

export type SudoUser = {
  hasTwoFA?: boolean;
  twoFaMethod?: string;
  hasPassword: boolean;
};

export type SudoInput = { password?: string | null; code?: string | null };

export type SudoRejection =
  'MISSING_CREDENTIALS' | 'NO_PASSWORD' | 'CODE_REQUIRED' | 'UNSUPPORTED_2FA';

export type SudoPlan =
  | { action: 'reject'; reason: SudoRejection }
  | {
      /** send the SMS challenge; `password` is checked first when it was given */
      action: 'sms_challenge';
      verifyPassword: boolean;
    }
  | {
      action: 'verify';
      verifyPassword: boolean;
      verifyTotp: boolean;
      verifySms: boolean;
    };

const present = (value?: string | null) => typeof value === 'string' && value !== '';

function normalizeMethod(method?: string): string | undefined {
  return method === 'phone' ? 'sms' : method;
}

/**
 * What a /sudo request must prove.
 *  - no 2FA: the password, and only a password (a code is meaningless);
 *  - authenticator 2FA: a TOTP code is required; a password is verified when given;
 *  - sms 2FA: without a code the request starts the challenge (the password is verified
 *    when given); with a code the SMS code is verified (and the password when given);
 *  - any other 2FA method is refused. A password alone never satisfies a 2FA user.
 */
export function planSudo(user: SudoUser, input: SudoInput): SudoPlan {
  const hasPassword = present(input.password);
  const hasCode = present(input.code);
  if (!user.hasTwoFA) {
    if (!hasPassword) return { action: 'reject', reason: 'MISSING_CREDENTIALS' };
    if (!user.hasPassword) return { action: 'reject', reason: 'NO_PASSWORD' };
    return {
      action: 'verify',
      verifyPassword: true,
      verifyTotp: false,
      verifySms: false,
    };
  }
  if (hasPassword && !user.hasPassword) {
    return { action: 'reject', reason: 'NO_PASSWORD' };
  }
  const method = normalizeMethod(user.twoFaMethod);
  if (method === 'authenticator') {
    if (!hasCode) return { action: 'reject', reason: 'CODE_REQUIRED' };
    return {
      action: 'verify',
      verifyPassword: hasPassword,
      verifyTotp: true,
      verifySms: false,
    };
  }
  if (method === 'sms') {
    if (!hasCode) return { action: 'sms_challenge', verifyPassword: hasPassword };
    return {
      action: 'verify',
      verifyPassword: hasPassword,
      verifyTotp: false,
      verifySms: true,
    };
  }
  return { action: 'reject', reason: 'UNSUPPORTED_2FA' };
}

export type FailureRecord = { failures: number; lockedUntil: number };

export const emptyFailures = (): FailureRecord => ({ failures: 0, lockedUntil: 0 });

export function parseFailureRecord(raw: string | null | undefined): FailureRecord {
  if (!raw) return emptyFailures();
  try {
    const parsed = JSON.parse(raw);
    return {
      failures: Number.isFinite(parsed?.failures) ? parsed.failures : 0,
      lockedUntil: Number.isFinite(parsed?.lockedUntil) ? parsed.lockedUntil : 0,
    };
  } catch {
    return emptyFailures();
  }
}

/** Whether sudo is locked at `now`, and for how long. */
export function lockStatus(
  record: FailureRecord,
  now: number,
): { locked: boolean; retryAfterMs: number } {
  const retryAfterMs = record.lockedUntil - now;
  return retryAfterMs > 0
    ? { locked: true, retryAfterMs }
    : { locked: false, retryAfterMs: 0 };
}

/**
 * Counts a failure. The SUDO_MAX_FAILURES-th failure locks sudo for SUDO_LOCK_MS. A lock
 * that has run out starts counting afresh.
 */
export function registerFailure(record: FailureRecord, now: number): FailureRecord {
  const base =
    record.lockedUntil > 0 && record.lockedUntil <= now ? emptyFailures() : record;
  const failures = base.failures + 1;
  return failures >= SUDO_MAX_FAILURES
    ? { failures, lockedUntil: now + SUDO_LOCK_MS }
    : { failures, lockedUntil: 0 };
}

/** The 30 s TOTP step a code that verified with `delta` belongs to. */
export function totpStep(now: number, delta: number): number {
  return Math.floor(now / TOTP_STEP_MS) + delta;
}

/** A step at or before the last accepted one is a replay. */
export function isTotpReplay(lastStep: number | null, step: number): boolean {
  return lastStep !== null && step <= lastStep;
}
