import { ConduitGrpcSdk, Indexable } from '@conduitplatform/grpc-sdk';
import { RefreshToken, User } from '../models/index.js';
import tokenConfig from '../config/token.config.js';
import {
  legacyRefreshDefaults,
  migrateLegacyRefreshRows,
} from '../utils/refreshTokenMigration.js';

export const REFRESH_SCHEMA_DEFAULTS = {
  expiryPeriod: tokenConfig.refreshTokens.expiryPeriod.default,
  extendable: tokenConfig.refreshTokens.extendable.default,
  maxLifetime: tokenConfig.refreshTokens.maxLifetime.default,
};

/**
 * Refresh tokens used to be stored in plaintext (`token`). Each such row gets
 * tokenHash = sha256(token), issuedAt = createdAt, extendable and maxExpiresOn from the
 * global config (maxLifetime clamped up to the refresh expiryPeriod), and the plaintext
 * is cleared. See migrateLegacyRefreshRows.
 */
export async function migrateRefreshTokens(grpcSdk: ConduitGrpcSdk) {
  let stored: Indexable | null = null;
  try {
    stored = await grpcSdk.config.get('authentication');
  } catch {
    // config not set yet: schema defaults apply
  }
  const defaults = legacyRefreshDefaults(stored?.refreshTokens, REFRESH_SCHEMA_DEFAULTS);
  const result = await migrateLegacyRefreshRows(
    RefreshToken.getInstance(grpcSdk.database ?? undefined) as never,
    defaults,
  );
  if (result.unmigrated > 0) {
    ConduitGrpcSdk.Logger.warn(
      `${result.unmigrated} legacy refresh token row(s) could not be migrated and were left unchanged`,
    );
  }
}

export async function runMigrations(grpcSdk: ConduitGrpcSdk) {
  if (!grpcSdk.database) {
    return;
  }
  const userModel = User.getInstance(grpcSdk.database);
  await userModel.updateMany({ twoFaMethod: 'phone' }, { twoFaMethod: 'sms' });

  await migrateRefreshTokens(grpcSdk).catch(e => {
    ConduitGrpcSdk.Logger.error(
      `Refresh token migration failed: ${(e as Error).message}`,
    );
  });

  await grpcSdk.database.deleteSchema('Service', true).catch(() => {
    // Schema may already be absent on fresh installs or repeat startups.
  });
}
