import {
  ensureAccessTokenJwtSecret,
  isJwtSecretEmpty,
  type PersistedConfigRead,
} from './jwtSecret.js';

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

export async function reconcileSharedAccessTokenJwtSecret<T extends JwtSecretConfig>(
  config: T,
  deps: JwtSecretReconcilerDeps<T>,
): Promise<void> {
  const persisted = await deps.readPersisted();

  if (!persisted.ok) {
    ensureAccessTokenJwtSecret(config);
    deps.syncConfig(config);
    return;
  }

  if (deps.configInitialized) {
    if (isJwtSecretEmpty(config.accessTokens.jwtSecret)) {
      const existing = persistedSecret(persisted);
      if (!isJwtSecretEmpty(existing)) {
        config.accessTokens.jwtSecret = existing!;
      }
    }
    deps.syncConfig(config);
    return;
  }

  const existing = persistedSecret(persisted);
  if (!isJwtSecretEmpty(existing)) {
    config.accessTokens.jwtSecret = existing!;
    deps.syncConfig(config);
    return;
  }

  await deps.withLock('authentication:jwtSecret', 10_000, async () => {
    const again = await deps.readPersisted();
    if (!again.ok) {
      ensureAccessTokenJwtSecret(config);
      deps.syncConfig(config);
      return;
    }
    const peer = persistedSecret(again);
    if (!isJwtSecretEmpty(peer)) {
      config.accessTokens.jwtSecret = peer!;
      deps.syncConfig(config);
      return;
    }
    ensureAccessTokenJwtSecret(config);
    deps.syncConfig(config);
    await deps.persistOverride(config);
    const after = await deps.readPersisted();
    if (after.ok && !isJwtSecretEmpty(after.config?.accessTokens?.jwtSecret)) {
      config.accessTokens.jwtSecret = after.config!.accessTokens!.jwtSecret!;
    }
    deps.syncConfig(config);
  });
}
