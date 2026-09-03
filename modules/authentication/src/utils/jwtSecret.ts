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
 * Only generate when both persisted and local values are empty.
 * shouldPersist is true only when the persisted secret is still empty.
 */
export function adoptPersistedJwtSecret(
  config: { accessTokens: { jwtSecret?: string | null } },
  persistedSecret?: string | null,
): { shouldPersist: boolean } {
  if (!isJwtSecretEmpty(persistedSecret)) {
    config.accessTokens.jwtSecret = persistedSecret!;
    return { shouldPersist: false };
  }
  if (isJwtSecretEmpty(config.accessTokens.jwtSecret)) {
    ensureAccessTokenJwtSecret(config);
  }
  return { shouldPersist: true };
}

/** Failed reads must not look like an empty secret (do not persist). */
export function decideSharedJwtSecret(
  config: { accessTokens: { jwtSecret?: string | null } },
  read: PersistedConfigRead<{ accessTokens?: { jwtSecret?: string | null } }>,
): { shouldPersist: boolean } {
  if (!read.ok) {
    return { shouldPersist: false };
  }
  return adoptPersistedJwtSecret(config, read.config?.accessTokens?.jwtSecret);
}
