import crypto from 'crypto';

export function isJwtSecretEmpty(secret?: string | null): boolean {
  return !secret?.trim();
}

export function ensureAccessTokenJwtSecret(config: {
  accessTokens: { jwtSecret?: string | null };
}) {
  if (isJwtSecretEmpty(config.accessTokens.jwtSecret)) {
    config.accessTokens.jwtSecret = crypto.randomBytes(64).toString('base64');
  }
  return config;
}

export type PersistedConfigRead<T> = { ok: true; config: T | null } | { ok: false };

export function isConfigMissingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Config for module not set');
}

/**
 * Prefer a persisted non-empty secret (including legacy S3CR3T).
 * Does not mint. shouldPersist is true only when persist is still empty.
 */
export function adoptPersistedJwtSecret(
  config: { accessTokens: { jwtSecret?: string | null } },
  persistedSecret?: string | null,
): { shouldPersist: boolean } {
  if (!isJwtSecretEmpty(persistedSecret)) {
    config.accessTokens.jwtSecret = persistedSecret!;
    return { shouldPersist: false };
  }
  return { shouldPersist: true };
}

export type JwtSecretReconcileMode = 'startup' | 'update';

/**
 * Failed reads must not look like an empty secret (do not persist).
 * startup: adopt a persisted non-empty secret (including S3CR3T).
 * update: keep an already-applied local secret so setConfig/bus cannot
 * revert a mint while Core still has the old persist value.
 */
export function decideSharedJwtSecret(
  config: { accessTokens: { jwtSecret?: string | null } },
  read: PersistedConfigRead<{ accessTokens?: { jwtSecret?: string | null } }>,
  mode: JwtSecretReconcileMode = 'startup',
): { shouldPersist: boolean } {
  if (!read.ok) {
    return { shouldPersist: false };
  }
  if (mode === 'update' && !isJwtSecretEmpty(config.accessTokens.jwtSecret)) {
    return { shouldPersist: false };
  }
  return adoptPersistedJwtSecret(config, read.config?.accessTokens?.jwtSecret);
}
