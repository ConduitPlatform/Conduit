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
