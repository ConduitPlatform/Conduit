import crypto from 'crypto';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

export const BIOMETRIC_CHALLENGE_TTL_MS = 2 * 60 * 1000;
export const BIOMETRIC_CHALLENGE_LOCK_TTL_MS = 10_000;
export const BIOMETRIC_CHALLENGE_UNAVAILABLE = 'Unable to issue biometric challenge';

export type BiometricChallengeToken = {
  createdAt: Date | string;
  data?: { clientId?: string; challenge?: string };
};

export function isBiometricChallengeExpired(
  createdAt: Date | string,
  now = Date.now(),
): boolean {
  return now - new Date(createdAt).getTime() > BIOMETRIC_CHALLENGE_TTL_MS;
}

export function findReusableBiometricChallenge<T extends BiometricChallengeToken>(
  newestToken: T | null,
  requestClientId: string,
  now = Date.now(),
): T | null {
  if (!newestToken || isBiometricChallengeExpired(newestToken.createdAt, now)) {
    return null;
  }
  if (!newestToken.data?.clientId || newestToken.data.clientId !== requestClientId) {
    return null;
  }
  if (!newestToken.data.challenge?.trim()) {
    return null;
  }
  return newestToken;
}

export function biometricChallengeLockResource(keyId: string, clientId: string): string {
  const digest = crypto
    .createHash('sha256')
    .update(`${keyId}\0${clientId}`)
    .digest('hex');
  return `authentication:biometricChallenge:${digest}`;
}

export interface BiometricChallengeIssuanceDeps<T extends BiometricChallengeToken> {
  usingLock: <R>(
    resource: string,
    ttl: number,
    fn: (signal: AbortSignal) => Promise<R>,
  ) => Promise<R>;
  findNewest: () => Promise<T | null>;
  deleteScope: () => Promise<unknown>;
  createToken: (challenge: string) => Promise<T>;
  randomChallenge?: () => string;
  now?: number;
}

function throwIfLockLost(signal: AbortSignal) {
  if (signal.aborted) {
    throw new GrpcError(status.UNAVAILABLE, BIOMETRIC_CHALLENGE_UNAVAILABLE);
  }
}

function wrapIssuanceError(error: unknown): never {
  if (error instanceof GrpcError) {
    throw error;
  }
  throw new GrpcError(status.UNAVAILABLE, BIOMETRIC_CHALLENGE_UNAVAILABLE);
}

export async function issueOrReuseBiometricLoginChallenge<
  T extends BiometricChallengeToken,
>(
  keyId: string,
  clientId: string,
  deps: BiometricChallengeIssuanceDeps<T>,
): Promise<string> {
  try {
    return await deps.usingLock(
      biometricChallengeLockResource(keyId, clientId),
      BIOMETRIC_CHALLENGE_LOCK_TTL_MS,
      async signal => {
        const newest = await deps.findNewest();
        throwIfLockLost(signal);
        const reusable = findReusableBiometricChallenge(newest, clientId, deps.now);
        const reusedChallenge = reusable?.data?.challenge?.trim();
        if (reusedChallenge) {
          return reusedChallenge;
        }
        await deps.deleteScope();
        throwIfLockLost(signal);
        const nextChallenge = (deps.randomChallenge ?? defaultChallenge)();
        const created = await deps.createToken(nextChallenge);
        throwIfLockLost(signal);
        const stored = created.data?.challenge?.trim();
        if (!stored) {
          throw new GrpcError(status.UNAVAILABLE, BIOMETRIC_CHALLENGE_UNAVAILABLE);
        }
        return stored;
      },
    );
  } catch (error) {
    wrapIssuanceError(error);
  }
}

function defaultChallenge() {
  return crypto.randomBytes(64).toString('hex');
}

export async function consumeBiometricChallenge<
  T extends { _id: string; data?: { clientId?: string } },
>(
  token: T,
  requestClientId: string,
  deleteOne: (id: string) => Promise<{ deletedCount: number }>,
): Promise<string> {
  const storedClientId = token.data?.clientId;
  if (!storedClientId || storedClientId !== requestClientId) {
    throw new GrpcError(
      status.PERMISSION_DENIED,
      "Responding client doesn't match requesting!",
    );
  }
  const consumed = await deleteOne(token._id);
  if (consumed.deletedCount === 0) {
    throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid signature!');
  }
  return storedClientId;
}

export function verifyBiometricSignature(
  publicKeyDerBase64: string,
  challenge: string,
  signatureBase64: string,
): boolean {
  const verifier = crypto.createVerify('sha256WithRSAEncryption');
  verifier.update(new Uint8Array(Buffer.from(challenge)));
  const cryptoKey = crypto.createPublicKey({
    key: publicKeyDerBase64,
    format: 'der',
    type: 'spki',
    encoding: 'base64',
  });
  return verifier.verify(cryptoKey, signatureBase64, 'base64');
}
