import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getConduitCode, GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { errors } from '../errors.js';
import {
  reconcileSharedSigningKeys,
  type SigningKeysConfig,
} from './signingReconciler.js';
import {
  emptySigning,
  generateSigningKeypair,
  isSigningEmpty,
} from './signingKeys.logic.js';
import type { PersistedConfigRead } from './jwtSecret.js';

function config(mode = 'jwt', signing = emptySigning()): SigningKeysConfig {
  return { accessTokens: { mode, signing } };
}

function serializeLock() {
  let queue = Promise.resolve();
  return async (_r: string, _t: number, fn: () => Promise<void>) => {
    const next = queue.then(fn, fn);
    queue = next.catch(() => undefined);
    await next;
  };
}

describe('reconcileSharedSigningKeys', () => {
  it('does nothing in session mode', async () => {
    let reads = 0;
    await reconcileSharedSigningKeys(config('session'), {
      configInitialized: false,
      readPersisted: async () => {
        reads += 1;
        return { ok: true, config: null };
      },
      syncConfig: () => {},
      persistOverride: async () => {},
      withLock: async () => {},
    });
    assert.equal(reads, 0);
  });

  it('mints once under the lock and verifies after persisting', async () => {
    const persist = { current: null as SigningKeysConfig | null };
    const local = config();
    let persistCalls = 0;
    await reconcileSharedSigningKeys(local, {
      configInitialized: false,
      readPersisted: async () => ({ ok: true, config: persist.current }),
      syncConfig: () => {},
      persistOverride: async next => {
        persistCalls += 1;
        persist.current = JSON.parse(JSON.stringify(next));
      },
      withLock: serializeLock(),
    });
    assert.equal(persistCalls, 1);
    assert.equal(isSigningEmpty(local.accessTokens.signing), false);
    assert.equal(
      local.accessTokens.signing?.kid,
      persist.current?.accessTokens.signing?.kid,
    );
  });

  it('two replicas converge on one keypair', async () => {
    const persist = { current: null as SigningKeysConfig | null };
    const lock = serializeLock();
    const replica = async () => {
      const local = config();
      await reconcileSharedSigningKeys(local, {
        configInitialized: false,
        readPersisted: async () => ({ ok: true, config: persist.current }),
        syncConfig: () => {},
        persistOverride: async next => {
          persist.current = JSON.parse(JSON.stringify(next));
        },
        withLock: lock,
      });
      return local;
    };
    const [a, b] = await Promise.all([replica(), replica()]);
    assert.ok(a.accessTokens.signing?.kid);
    assert.equal(a.accessTokens.signing?.kid, b.accessTokens.signing?.kid);
    assert.equal(a.accessTokens.signing?.privateKey, b.accessTokens.signing?.privateKey);
  });

  it('startup adopts a persisted block without writing', async () => {
    const pair = generateSigningKeypair();
    const local = config();
    await reconcileSharedSigningKeys(local, {
      configInitialized: false,
      readPersisted: async () => ({
        ok: true,
        config: {
          accessTokens: { mode: 'jwt', signing: { ...emptySigning(), ...pair } },
        },
      }),
      syncConfig: () => {},
      persistOverride: async () => assert.fail('must not persist'),
      withLock: async () => assert.fail('must not lock'),
    });
    assert.equal(local.accessTokens.signing?.kid, pair.kid);
  });

  it('a failed read with no local keys is unavailable and never persists', async () => {
    await assert.rejects(
      reconcileSharedSigningKeys(config(), {
        configInitialized: false,
        readPersisted: async (): Promise<PersistedConfigRead<SigningKeysConfig>> => ({
          ok: false,
        }),
        syncConfig: () => {},
        persistOverride: async () => assert.fail('must not persist'),
        withLock: async () => assert.fail('must not lock'),
      }),
      (e: unknown) =>
        e instanceof GrpcError &&
        e.code === status.UNAVAILABLE &&
        getConduitCode(e) === errors.SIGNING_KEYS_UNAVAILABLE.conduitCode,
    );
  });

  it('after startup it only syncs the applied config', async () => {
    let synced = 0;
    await reconcileSharedSigningKeys(config(), {
      configInitialized: true,
      readPersisted: async () => ({ ok: true, config: null }),
      syncConfig: () => {
        synced += 1;
      },
      persistOverride: async () => assert.fail('must not persist'),
      withLock: async () => assert.fail('must not lock'),
    });
    assert.equal(synced, 1);
  });
});
