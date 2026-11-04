import crypto from 'node:crypto';

/** SHA-256 hex of a refresh token. Only the hash is stored; the token is shown once. */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export type ExtendRefreshTokenInput = {
  now: Date | number;
  /** effective refresh expiry period, ms */
  expiryPeriod: number;
  maxExpiresOn: Date | number;
  extendable: boolean;
};

export type ExtendRefreshTokenResult =
  { ok: true; expiresOn: Date } | { ok: false; reason: 'NOT_EXTENDABLE' };

/**
 * The new expiry of an extended refresh token: min(now + expiryPeriod, maxExpiresOn).
 * Extension never passes the absolute cap, and is refused on a non-extendable token.
 */
export function extendRefreshToken(
  input: ExtendRefreshTokenInput,
): ExtendRefreshTokenResult {
  if (!input.extendable) return { ok: false, reason: 'NOT_EXTENDABLE' };
  const proposed = new Date(input.now).getTime() + input.expiryPeriod;
  const cap = new Date(input.maxExpiresOn).getTime();
  return { ok: true, expiresOn: new Date(Math.min(proposed, cap)) };
}

/** Absolute cap of a refresh token: issue time + max lifetime. */
export function refreshMaxExpiresOn(issuedAt: Date | number, maxLifetime: number): Date {
  return new Date(new Date(issuedAt).getTime() + maxLifetime);
}

/** Expiry of a freshly issued refresh token, never past its cap. */
export function initialRefreshExpiry(
  issuedAt: Date | number,
  expiryPeriod: number,
  maxLifetime: number,
): Date {
  const issued = new Date(issuedAt).getTime();
  return new Date(Math.min(issued + expiryPeriod, issued + maxLifetime));
}

/**
 * The cap of a stored refresh token under the policy in force now: the stored cap, and
 * never past issuedAt + the (possibly since tightened) policy maxLifetime. Legacy rows
 * without a cap fall back to their expiry.
 */
export function effectiveMaxExpiresOn(
  row: {
    issuedAt?: Date | number | null;
    maxExpiresOn?: Date | number | null;
    expiresOn: Date | number;
  },
  policyMaxLifetime: number,
): Date {
  const stored = new Date(row.maxExpiresOn ?? row.expiresOn).getTime();
  if (row.issuedAt === undefined || row.issuedAt === null) return new Date(stored);
  const tightened = new Date(row.issuedAt).getTime() + policyMaxLifetime;
  return new Date(Math.min(stored, tightened));
}
