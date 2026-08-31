import crypto from 'crypto';

export function ensureAccessTokenJwtSecret(config: {
  accessTokens: { jwtSecret?: string | null };
}) {
  if (!config.accessTokens.jwtSecret?.trim()) {
    config.accessTokens.jwtSecret = crypto.randomBytes(64).toString('base64');
  }
  return config;
}
