import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  type CdnConfiguration,
  cdnConfigsAreEqual,
  migrateCdnConfigChanges,
} from './cdnConfigMigration.js';

export interface SyncCdnConfigOptions {
  failOnError: boolean;
  migrate?: (grpcSdk: ConduitGrpcSdk, previous: CdnConfiguration) => Promise<void>;
}

export async function syncCdnConfig(
  grpcSdk: ConduitGrpcSdk,
  previous: CdnConfiguration,
  current: CdnConfiguration,
  options: SyncCdnConfigOptions,
): Promise<CdnConfiguration> {
  if (cdnConfigsAreEqual(previous, current)) {
    return previous;
  }
  try {
    await (options.migrate ?? migrateCdnConfigChanges)(grpcSdk, previous);
    return { ...current };
  } catch (e) {
    if (options.failOnError) throw e;
    const reason = e instanceof Error ? e.message : String(e);
    ConduitGrpcSdk.Logger.error(
      `CDN configuration migration failed (${reason}). Keeping the previous CDN snapshot; the migration will be retried on the next config update.`,
    );
    return previous;
  }
}
