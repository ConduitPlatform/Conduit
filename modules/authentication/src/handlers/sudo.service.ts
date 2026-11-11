import { ModuleErrorDefinition } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { authErrors, ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
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

const REJECTIONS: Record<SudoRejection, ModuleErrorDefinition> = {
  MISSING_CREDENTIALS: errors.SUDO_PASSWORD_REQUIRED,
  NO_PASSWORD: {
    ...errors.PASSWORD_AUTH_NOT_AVAILABLE,
    grpcCode: status.FAILED_PRECONDITION,
    message: 'User has no password',
  },
  CODE_REQUIRED: errors.SUDO_CODE_REQUIRED,
  UNSUPPORTED_2FA: {
    ...errors.TWO_FA_METHOD_UNAVAILABLE,
    message: '2FA method is not supported for sudo',
  },
};

const failKey = (id: string) => `sudo:fail:${id}`;
const totpKey = (id: string) => `sudo:totp:${id}`;
const totpStepKey = (id: string, step: number) => `sudo:totp:${id}:${step}`;

type SudoResult = { accessToken: string } | { challenge: 'sms' };
type SudoPlan = Exclude<ReturnType<typeof planSudo>, { action: 'reject' }>;

interface SudoContext<U extends SudoUserRecord> {
  deps: SudoDeps<U>;
  state: SudoStateStore;
  user: U;
  id: string;
  input: SudoInput;
}

/** Resolves the state store, the active user and the plan, or throws the matching error. */
async function prepareSudo<U extends SudoUserRecord>(
  deps: SudoDeps<U>,
  input: SudoInput,
): Promise<{ state: SudoStateStore; user: U; plan: SudoPlan }> {
  const state = deps.state;
  if (!state) {
    throw new ModuleError(errors.STEP_UP_UNAVAILABLE);
  }
  const user = await deps.loadUser();
  if (!user || !user.active) {
    throw new ModuleError(authErrors.USER_BLOCKED);
  }
  const plan = planSudo(
    {
      hasTwoFA: user.hasTwoFA,
      twoFaMethod: user.twoFaMethod,
      hasPassword: !!user.hashedPassword,
    },
    input,
  );
  if (plan.action === 'reject') {
    throw new ModuleError(REJECTIONS[plan.reason]);
  }
  return { state, user, plan };
}

/** Reads the failure record and throws RESOURCE_EXHAUSTED while the user is locked out. */
async function readLockout(
  state: SudoStateStore,
  id: string,
  now: number,
): Promise<FailureRecord> {
  const record = parseFailureRecord(await state.getKey(failKey(id)));
  const lock = lockStatus(record, now);
  if (lock.locked) {
    throw new ModuleError({
      ...errors.SUDO_LOCKED_OUT,
      message: `Too many failed attempts. Try again in ${Math.ceil(lock.retryAfterMs / 1000)} seconds`,
    });
  }
  return record;
}

/** Persists a failed attempt and throws UNAUTHENTICATED. */
async function recordFailure<U extends SudoUserRecord>(
  ctx: SudoContext<U>,
  record: FailureRecord,
): Promise<never> {
  const next = registerFailure(record, ctx.deps.now());
  await ctx.state.setKey(failKey(ctx.id), JSON.stringify(next), SUDO_LOCK_MS);
  throw new ModuleError(errors.INVALID_CREDENTIALS);
}

async function checkPasswordProof<U extends SudoUserRecord>(
  ctx: SudoContext<U>,
): Promise<boolean> {
  const hashed = ctx.user.hashedPassword;
  return !!hashed && (await ctx.deps.checkPassword(String(ctx.input.password), hashed));
}

async function issueSmsChallenge<U extends SudoUserRecord>(
  ctx: SudoContext<U>,
): Promise<{ challenge: 'sms' }> {
  await ctx.deps.sendSmsChallenge(ctx.user);
  return { challenge: 'sms' };
}

/** The last accepted TOTP step of the user, null when none (or unparsable). */
async function readLastTotpStep(state: SudoStateStore, id: string) {
  const lastRaw = await state.getKey(totpKey(id));
  const last = lastRaw === null || lastRaw === undefined ? null : Number(lastRaw);
  return Number.isFinite(last) ? last : null;
}

async function checkTotpProof<U extends SudoUserRecord>(
  ctx: SudoContext<U>,
): Promise<boolean> {
  const { deps, state, user, id, input } = ctx;
  const secret = await deps.getTotpSecret(user);
  const delta = secret ? deps.verifyTotp(secret, String(input.code)) : null;
  if (delta === null) return false;
  const step = totpStep(deps.now(), delta);
  // a step older than the last accepted one is a replay
  if (isTotpReplay(await readLastTotpStep(state, id), step)) return false;
  // the same step is claimed atomically (SET NX): of two concurrent requests with one
  // code only one gets past here
  if (!(await state.setIfAbsent(totpStepKey(id, step), '1', TOTP_REPLAY_MS))) {
    return false;
  }
  await state.setKey(totpKey(id), String(step), TOTP_REPLAY_MS);
  return true;
}

async function checkSmsProof<U extends SudoUserRecord>(
  ctx: SudoContext<U>,
): Promise<boolean> {
  return ctx.deps.verifySms(ctx.user, String(ctx.input.code));
}

/**
 * The /sudo flow: plan the required proofs, enforce the per-user lockout, verify,
 * remember the TOTP step (replay protection) and mint. Fails closed when the state
 * store (Redis) is unavailable.
 */
export async function performSudo<U extends SudoUserRecord>(
  deps: SudoDeps<U>,
  input: SudoInput,
): Promise<SudoResult> {
  const { state, user, plan } = await prepareSudo(deps, input);
  const ctx: SudoContext<U> = { deps, state, user, id: String(user._id), input };
  const record = await readLockout(state, ctx.id, deps.now());

  if (plan.verifyPassword && !(await checkPasswordProof(ctx))) {
    return recordFailure(ctx, record);
  }
  if (plan.action === 'sms_challenge') return issueSmsChallenge(ctx);
  if (plan.verifyTotp && !(await checkTotpProof(ctx))) return recordFailure(ctx, record);
  if (plan.verifySms && !(await checkSmsProof(ctx))) return recordFailure(ctx, record);

  await state.clearKey(failKey(ctx.id));
  return deps.mint(user);
}
