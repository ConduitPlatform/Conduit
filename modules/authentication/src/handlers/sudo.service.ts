import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  FailureRecord,
  isTotpReplay,
  lockStatus,
  parseFailureRecord,
  planSudo,
  registerFailure,
  SUDO_LOCK_MS,
  SudoInput,
  SudoRejection,
  totpStep,
  TOTP_REPLAY_MS,
} from './sudo.logic.js';

export interface SudoStateStore {
  getKey(key: string): Promise<string | null>;
  setKey(key: string, value: string, expiryMs?: number): Promise<unknown>;
  clearKey(key: string): Promise<unknown>;
  /**
   * Atomically sets the key only when it does not exist (Redis SET NX with a TTL).
   * Resolves true when this call set it. Rejects when the store is unavailable.
   */
  setIfAbsent(key: string, value: string, expiryMs: number): Promise<boolean>;
}

export interface SudoUserRecord {
  _id: string;
  active?: boolean;
  hasTwoFA?: boolean;
  twoFaMethod?: string;
  hashedPassword?: string | null;
}

export interface SudoDeps<U extends SudoUserRecord> {
  state: SudoStateStore | null;
  now: () => number;
  loadUser: () => Promise<U | null>;
  checkPassword: (password: string, hashed: string) => Promise<boolean>;
  /** the TOTP secret of the user, null when none is stored */
  getTotpSecret: (user: U) => Promise<string | null>;
  /** delta of the matching step, or null when the code does not match */
  verifyTotp: (secret: string, code: string) => number | null;
  sendSmsChallenge: (user: U) => Promise<void>;
  verifySms: (user: U, code: string) => Promise<boolean>;
  mint: (user: U) => Promise<{ accessToken: string }>;
}

const REJECTIONS: Record<SudoRejection, [number, string]> = {
  MISSING_CREDENTIALS: [status.INVALID_ARGUMENT, 'A password is required'],
  NO_PASSWORD: [status.FAILED_PRECONDITION, 'User has no password'],
  CODE_REQUIRED: [status.INVALID_ARGUMENT, 'A 2FA code is required'],
  UNSUPPORTED_2FA: [status.FAILED_PRECONDITION, '2FA method is not supported for sudo'],
};

const failKey = (id: string) => `sudo:fail:${id}`;
const totpKey = (id: string) => `sudo:totp:${id}`;
const totpStepKey = (id: string, step: number) => `sudo:totp:${id}:${step}`;

/**
 * The /sudo flow: plan the required proofs, enforce the per-user lockout, verify,
 * remember the TOTP step (replay protection) and mint. Fails closed when the state
 * store (Redis) is unavailable.
 */
export async function performSudo<U extends SudoUserRecord>(
  deps: SudoDeps<U>,
  input: SudoInput,
): Promise<{ accessToken: string } | { challenge: 'sms' }> {
  const state = deps.state;
  if (!state) {
    throw new GrpcError(status.UNAVAILABLE, 'Step-up authentication is unavailable');
  }
  const user = await deps.loadUser();
  if (!user || !user.active) {
    throw new GrpcError(status.PERMISSION_DENIED, 'User is blocked or deleted');
  }
  const id = String(user._id);
  const plan = planSudo(
    {
      hasTwoFA: user.hasTwoFA,
      twoFaMethod: user.twoFaMethod,
      hasPassword: !!user.hashedPassword,
    },
    input,
  );
  if (plan.action === 'reject') {
    const [code, message] = REJECTIONS[plan.reason];
    throw new GrpcError(code, message);
  }

  const record: FailureRecord = parseFailureRecord(await state.getKey(failKey(id)));
  const lock = lockStatus(record, deps.now());
  if (lock.locked) {
    throw new GrpcError(
      status.RESOURCE_EXHAUSTED,
      `Too many failed attempts. Try again in ${Math.ceil(lock.retryAfterMs / 1000)} seconds`,
    );
  }
  const fail = async (message = 'Invalid credentials'): Promise<never> => {
    const next = registerFailure(record, deps.now());
    await state.setKey(failKey(id), JSON.stringify(next), SUDO_LOCK_MS);
    throw new GrpcError(status.UNAUTHENTICATED, message);
  };

  if (plan.verifyPassword) {
    const ok =
      !!user.hashedPassword &&
      (await deps.checkPassword(String(input.password), user.hashedPassword));
    if (!ok) return fail();
  }

  if (plan.action === 'sms_challenge') {
    await deps.sendSmsChallenge(user);
    return { challenge: 'sms' };
  }

  if (plan.verifyTotp) {
    const secret = await deps.getTotpSecret(user);
    const delta = secret ? deps.verifyTotp(secret, String(input.code)) : null;
    if (delta === null) return fail();
    const step = totpStep(deps.now(), delta);
    // a step older than the last accepted one is a replay
    const lastRaw = await state.getKey(totpKey(id));
    const last = lastRaw === null || lastRaw === undefined ? null : Number(lastRaw);
    if (isTotpReplay(Number.isFinite(last) ? last : null, step)) return fail();
    // the same step is claimed atomically (SET NX): of two concurrent requests with one
    // code only one gets past here
    if (!(await state.setIfAbsent(totpStepKey(id, step), '1', TOTP_REPLAY_MS))) {
      return fail();
    }
    await state.setKey(totpKey(id), String(step), TOTP_REPLAY_MS);
  }

  if (plan.verifySms) {
    if (!(await deps.verifySms(user, String(input.code)))) return fail();
  }

  await state.clearKey(failKey(id));
  return deps.mint(user);
}
