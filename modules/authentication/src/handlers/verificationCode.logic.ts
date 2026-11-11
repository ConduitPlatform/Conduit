import { createHash } from 'crypto';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';

export const EMAIL_CODE_TTL_MS = 2 * 60 * 1000;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

export type ConsumeKeyIfMatches = (
  keyName: string,
  attemptsKey: string,
  value: string,
  maxAttempts: number,
) => Promise<boolean>;

/** The hash tag keeps both keys in one Redis Cluster slot. */
export function emailCodeKeys(email: string) {
  const tag = `{${createHash('sha256').update(email).digest('hex')}}`;
  return { codeKey: tag, attemptsKey: `${tag}:attempts` };
}

export async function consumeEmailVerificationCode(
  consumeKeyIfMatches: ConsumeKeyIfMatches,
  email: string,
  code: string,
): Promise<void> {
  const { codeKey, attemptsKey } = emailCodeKeys(email);
  if (!(await consumeKeyIfMatches(codeKey, attemptsKey, code, EMAIL_CODE_MAX_ATTEMPTS))) {
    throw new ModuleError(errors.VERIFICATION_CODE_INVALID);
  }
}
