import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  decideSharedJwtSecret,
  ensureAccessTokenJwtSecret,
  isJwtSecretEmpty,
  type PersistedConfigRead,
} from './jwtSecret.js';

export const JWT_SECRET_UNAVAILABLE = 'Unable to reconcile access token signing secret';

export type JwtSecretConfig = { accessTokens: { jwtSecret?: string | null } };

export interface JwtSecretReconcilerDeps<T extends JwtSecretConfig> {
  configInitialized: boolean;
  readPersisted: () => Promise<PersistedConfigRead<T>>;
  syncConfig: (config: T) => void;
  persistOverride: (config: T) => Promise<void>;
  withLock: (resource: string, ttl: number, fn: () => Promise<void>) => Promise<void>;
}

function persistedSecret<T extends JwtSecretConfig>(
  read: PersistedConfigRead<T>,
): string | null {
  if (!read.ok) {
    return null;
  }
  return read.config?.accessTokens?.jwtSecret ?? null;
}

function cloneConfig<T extends JwtSecretConfig>(config: T): T {
  return {
    ...config,
    accessTokens: { ...config.accessTokens },
  };
}

function throwUnavailable(): never {
  throw new GrpcError(status.UNAVAILABLE, JWT_SECRET_UNAVAILABLE);
}

export async function reconcileSharedAccessTokenJwtSecret<T extends JwtSecretConfig>(
  config: T,
  deps: JwtSecretReconcilerDeps<T>,
): Promise<void> {
  const persisted = await deps.readPersisted();

  if (!persisted.ok) {
    if (isJwtSecretEmpty(config.accessTokens.jwtSecret)) {
      throwUnavailable();
    }
    deps.syncConfig(config);
    return;
  }

  const mode = deps.configInitialized ? 'update' : 'startup';
  const decision = decideSharedJwtSecret(config, persisted, mode);
  if (!decision.shouldPersist) {
    deps.syncConfig(config);
    return;
  }

  if (deps.configInitialized) {
    deps.syncConfig(config);
    return;
  }

  await deps.withLock('authentication:jwtSecret', 10_000, async () => {
    const again = await deps.readPersisted();
    if (!again.ok) {
      throwUnavailable();
    }
    const peer = persistedSecret(again);
    if (!isJwtSecretEmpty(peer)) {
      config.accessTokens.jwtSecret = peer!;
      deps.syncConfig(config);
      return;
    }

    const candidate = cloneConfig(config);
    ensureAccessTokenJwtSecret(candidate);
    await deps.persistOverride(candidate);

    const after = await deps.readPersisted();
    const verified = persistedSecret(after);
    if (!after.ok || isJwtSecretEmpty(verified)) {
      throwUnavailable();
    }
    config.accessTokens.jwtSecret = verified!;
    deps.syncConfig(config);
  });
}
