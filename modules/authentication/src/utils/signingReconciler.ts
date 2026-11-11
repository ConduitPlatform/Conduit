import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import type { PersistedConfigRead } from './jwtSecret.js';
import {
  ensureSigning,
  isSigningEmpty,
  type SigningConfig,
} from './signingKeys.logic.js';

export const SIGNING_KEYS_UNAVAILABLE = 'Unable to reconcile access token signing keys';

export type SigningKeysConfig = {
  accessTokens: { mode?: string | null; signing?: Partial<SigningConfig> | null };
};

export interface SigningKeysReconcilerDeps<T extends SigningKeysConfig> {
  configInitialized: boolean;
  readPersisted: () => Promise<PersistedConfigRead<T>>;
  syncConfig: (config: T) => void;
  persistOverride: (config: T) => Promise<void>;
  withLock: (resource: string, ttl: number, fn: () => Promise<void>) => Promise<void>;
}

function persistedSigning<T extends SigningKeysConfig>(
  read: PersistedConfigRead<T>,
): Partial<SigningConfig> | null {
  if (!read.ok) return null;
  return read.config?.accessTokens?.signing ?? null;
}

function cloneConfig<T extends SigningKeysConfig>(config: T): T {
  return {
    ...config,
    accessTokens: {
      ...config.accessTokens,
      signing: { ...config.accessTokens.signing },
    },
  };
}

function throwUnavailable(): never {
  throw new ModuleError(errors.SIGNING_KEYS_UNAVAILABLE, SIGNING_KEYS_UNAVAILABLE);
}

/**
 * Replicas must agree on ONE signing keypair (jwt mode only; session mode never needs
 * one). Startup adopts the persisted block when present, otherwise mints once under the
 * lock, persists and verifies the persisted result. Later config updates keep the applied
 * block (a missing one is minted by `preConfig`, which persists with the update itself).
 * A failed read must not persist.
 */
export async function reconcileSharedSigningKeys<T extends SigningKeysConfig>(
  config: T,
  deps: SigningKeysReconcilerDeps<T>,
): Promise<void> {
  if (config.accessTokens.mode !== 'jwt') return;

  const persisted = await deps.readPersisted();
  if (!persisted.ok) {
    if (isSigningEmpty(config.accessTokens.signing)) throwUnavailable();
    deps.syncConfig(config);
    return;
  }

  if (deps.configInitialized) {
    deps.syncConfig(config);
    return;
  }

  const adopt = (signing: Partial<SigningConfig>) => {
    config.accessTokens.signing = { ...signing };
    deps.syncConfig(config);
  };

  const existing = persistedSigning(persisted);
  if (!isSigningEmpty(existing)) {
    adopt(existing!);
    return;
  }

  await deps.withLock('authentication:signingKeys', 10_000, async () => {
    const again = await deps.readPersisted();
    if (!again.ok) throwUnavailable();
    const peer = persistedSigning(again);
    if (!isSigningEmpty(peer)) {
      adopt(peer!);
      return;
    }

    const candidate = cloneConfig(config);
    candidate.accessTokens.signing = ensureSigning(candidate.accessTokens.signing);
    await deps.persistOverride(candidate);

    const after = await deps.readPersisted();
    const verified = persistedSigning(after);
    if (!after.ok || isSigningEmpty(verified)) throwUnavailable();
    adopt(verified!);
  });
}
