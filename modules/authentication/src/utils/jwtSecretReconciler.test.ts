import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { merge } from 'lodash-es';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  JWT_SECRET_UNAVAILABLE,
  reconcileSharedAccessTokenJwtSecret,
} from './jwtSecretReconciler.js';
import { ensureAccessTokenJwtSecret, type PersistedConfigRead } from './jwtSecret.js';

type AuthConfig = { accessTokens: { jwtSecret?: string | null }; active?: boolean };

function emptyConfig(): AuthConfig {
  return { accessTokens: { jwtSecret: '' }, active: true };
}

function serializeLock() {
  let queue = Promise.resolve();
  return async (_resource: string, _ttl: number, fn: () => Promise<void>) => {
    const next = queue.then(fn, fn);
    queue = next.catch(() => undefined);
    await next;
  };
}

function isUnavailable(error: unknown) {
  return (
    error instanceof GrpcError &&
    error.code === status.UNAVAILABLE &&
    error.message === JWT_SECRET_UNAVAILABLE
  );
}

describe('reconcileSharedAccessTokenJwtSecret', () => {
  it('first install persists one secret under the lock', async () => {
    const persist = { current: null as AuthConfig | null };
    const convict = emptyConfig();
    const controller = { config: emptyConfig() };
    let persistCalls = 0;
    let locked = false;

    await reconcileSharedAccessTokenJwtSecret(convict, {
      configInitialized: false,
      readPersisted: async () => ({ ok: true, config: persist.current }),
      syncConfig: config => {
        convict.accessTokens.jwtSecret = config.accessTokens.jwtSecret;
        controller.config = { ...config, accessTokens: { ...config.accessTokens } };
      },
      persistOverride: async config => {
        persistCalls += 1;
        assert.equal(locked, true);
        assert.ok(config.accessTokens.jwtSecret?.trim());
        persist.current = {
          accessTokens: { jwtSecret: config.accessTokens.jwtSecret },
          active: config.active,
        };
      },
      withLock: async (_resource, _ttl, fn) => {
        locked = true;
        assert.equal(convict.accessTokens.jwtSecret, '');
        await fn();
        locked = false;
      },
    });

    assert.equal(persistCalls, 1);
    const persistedSecret = persist.current?.accessTokens.jwtSecret;
    assert.ok(persistedSecret?.trim());
    assert.equal(convict.accessTokens.jwtSecret, persistedSecret);
    assert.equal(controller.config.accessTokens.jwtSecret, persistedSecret);
  });

  it('two replicas converge on the same persisted secret', async () => {
    const persist = { current: null as AuthConfig | null };
    const lock = serializeLock();
    const replica = async () => {
      const convict = emptyConfig();
      const controller = { config: emptyConfig() };
      await reconcileSharedAccessTokenJwtSecret(convict, {
        configInitialized: false,
        readPersisted: async () => ({ ok: true, config: persist.current }),
        syncConfig: config => {
          convict.accessTokens.jwtSecret = config.accessTokens.jwtSecret;
          controller.config = { ...config, accessTokens: { ...config.accessTokens } };
        },
        persistOverride: async config => {
          persist.current = {
            accessTokens: { jwtSecret: config.accessTokens.jwtSecret },
            active: config.active,
          };
        },
        withLock: lock,
      });
      return { convict, controller };
    };

    const [a, b] = await Promise.all([replica(), replica()]);
    const sharedSecret = persist.current?.accessTokens.jwtSecret;
    assert.ok(sharedSecret?.trim());
    assert.equal(a.convict.accessTokens.jwtSecret, sharedSecret);
    assert.equal(b.convict.accessTokens.jwtSecret, sharedSecret);
    assert.equal(
      a.controller.config.accessTokens.jwtSecret,
      b.controller.config.accessTokens.jwtSecret,
    );
  });

  it('startup adopts persisted S3CR3T without writing', async () => {
    const convict = { accessTokens: { jwtSecret: 'local-mint' } };
    let persistCalls = 0;
    await reconcileSharedAccessTokenJwtSecret(convict, {
      configInitialized: false,
      readPersisted: async () => ({
        ok: true,
        config: { accessTokens: { jwtSecret: 'S3CR3T' } },
      }),
      syncConfig: config => {
        convict.accessTokens.jwtSecret = config.accessTokens.jwtSecret;
      },
      persistOverride: async () => {
        persistCalls += 1;
      },
      withLock: async () => {
        throw new Error('lock should not run');
      },
    });
    assert.equal(convict.accessTokens.jwtSecret, 'S3CR3T');
    assert.equal(persistCalls, 0);
  });

  it('startup adopts a persisted custom secret without writing', async () => {
    const convict = emptyConfig();
    let persistCalls = 0;
    await reconcileSharedAccessTokenJwtSecret(convict, {
      configInitialized: false,
      readPersisted: async () => ({
        ok: true,
        config: { accessTokens: { jwtSecret: 'custom-secret' } },
      }),
      syncConfig: config => {
        convict.accessTokens.jwtSecret = config.accessTokens.jwtSecret;
      },
      persistOverride: async () => {
        persistCalls += 1;
      },
      withLock: async () => {
        throw new Error('lock should not run');
      },
    });
    assert.equal(convict.accessTokens.jwtSecret, 'custom-secret');
    assert.equal(persistCalls, 0);
  });

  it('lock loser reloads convict with the peer winner', async () => {
    const convict = emptyConfig();
    let persistCalls = 0;
    await reconcileSharedAccessTokenJwtSecret(convict, {
      configInitialized: false,
      readPersisted: async (): Promise<PersistedConfigRead<AuthConfig>> => ({
        ok: true,
        config: convict.accessTokens.jwtSecret
          ? { accessTokens: { jwtSecret: convict.accessTokens.jwtSecret } }
          : null,
      }),
      syncConfig: config => {
        convict.accessTokens.jwtSecret = config.accessTokens.jwtSecret;
      },
      persistOverride: async () => {
        persistCalls += 1;
      },
      withLock: async (_resource, _ttl, fn) => {
        convict.accessTokens.jwtSecret = 'winner-B';
        await fn();
      },
    });
    assert.equal(convict.accessTokens.jwtSecret, 'winner-B');
    assert.equal(persistCalls, 0);
    const merged = merge(
      { accessTokens: { jwtSecret: convict.accessTokens.jwtSecret }, active: true },
      { active: false },
    );
    assert.equal(merged.accessTokens.jwtSecret, 'winner-B');
  });

  it('runtime empty PATCH mints locally and does not override-persist', async () => {
    const convict = { accessTokens: { jwtSecret: '' } };
    ensureAccessTokenJwtSecret(convict);
    let persistCalls = 0;
    await reconcileSharedAccessTokenJwtSecret(convict, {
      configInitialized: true,
      readPersisted: async () => ({
        ok: true,
        config: { accessTokens: { jwtSecret: 'S3CR3T' } },
      }),
      syncConfig: config => {
        convict.accessTokens.jwtSecret = config.accessTokens.jwtSecret;
      },
      persistOverride: async () => {
        persistCalls += 1;
      },
      withLock: async () => {
        throw new Error('lock should not run');
      },
    });
    assert.ok(convict.accessTokens.jwtSecret.trim());
    assert.notEqual(convict.accessTokens.jwtSecret, 'S3CR3T');
    assert.equal(persistCalls, 0);
  });

  it('failed initial read with a non-empty secret keeps it and does not persist', async () => {
    const convict = { accessTokens: { jwtSecret: 'S3CR3T' } };
    let persistCalls = 0;
    let syncCalls = 0;
    await reconcileSharedAccessTokenJwtSecret(convict, {
      configInitialized: false,
      readPersisted: async () => ({ ok: false }),
      syncConfig: config => {
        syncCalls += 1;
        convict.accessTokens.jwtSecret = config.accessTokens.jwtSecret;
      },
      persistOverride: async () => {
        persistCalls += 1;
      },
      withLock: async () => {
        throw new Error('lock should not run');
      },
    });
    assert.equal(convict.accessTokens.jwtSecret, 'S3CR3T');
    assert.equal(syncCalls, 1);
    assert.equal(persistCalls, 0);
  });

  it('failed initial read with an empty secret rejects without mutating', async () => {
    const convict = emptyConfig();
    let persistCalls = 0;
    let syncCalls = 0;
    await assert.rejects(
      () =>
        reconcileSharedAccessTokenJwtSecret(convict, {
          configInitialized: false,
          readPersisted: async () => ({ ok: false }),
          syncConfig: () => {
            syncCalls += 1;
          },
          persistOverride: async () => {
            persistCalls += 1;
          },
          withLock: async () => {
            throw new Error('lock should not run');
          },
        }),
      isUnavailable,
    );
    assert.equal(convict.accessTokens.jwtSecret, '');
    assert.equal(syncCalls, 0);
    assert.equal(persistCalls, 0);
  });

  it('failed inside-lock read rejects without mutating', async () => {
    const convict = emptyConfig();
    let persistCalls = 0;
    let syncCalls = 0;
    let reads = 0;
    await assert.rejects(
      () =>
        reconcileSharedAccessTokenJwtSecret(convict, {
          configInitialized: false,
          readPersisted: async () => {
            reads += 1;
            return reads === 1 ? { ok: true, config: null } : { ok: false };
          },
          syncConfig: () => {
            syncCalls += 1;
          },
          persistOverride: async () => {
            persistCalls += 1;
          },
          withLock: async (_resource, _ttl, fn) => fn(),
        }),
      isUnavailable,
    );
    assert.equal(convict.accessTokens.jwtSecret, '');
    assert.equal(syncCalls, 0);
    assert.equal(persistCalls, 0);
  });

  it('persist throw rejects without publishing the candidate', async () => {
    const convict = emptyConfig();
    let syncCalls = 0;
    await assert.rejects(
      () =>
        reconcileSharedAccessTokenJwtSecret(convict, {
          configInitialized: false,
          readPersisted: async () => ({ ok: true, config: null }),
          syncConfig: () => {
            syncCalls += 1;
          },
          persistOverride: async () => {
            throw new Error('core write failed');
          },
          withLock: async (_resource, _ttl, fn) => fn(),
        }),
      (error: unknown) => error instanceof Error && error.message === 'core write failed',
    );
    assert.equal(convict.accessTokens.jwtSecret, '');
    assert.equal(syncCalls, 0);
  });

  it('failed read-back after persist rejects without publishing the candidate', async () => {
    const convict = emptyConfig();
    let persistCalls = 0;
    let syncCalls = 0;
    let reads = 0;
    await assert.rejects(
      () =>
        reconcileSharedAccessTokenJwtSecret(convict, {
          configInitialized: false,
          readPersisted: async () => {
            reads += 1;
            if (reads <= 2) {
              return { ok: true, config: null };
            }
            return { ok: false };
          },
          syncConfig: () => {
            syncCalls += 1;
          },
          persistOverride: async () => {
            persistCalls += 1;
          },
          withLock: async (_resource, _ttl, fn) => fn(),
        }),
      isUnavailable,
    );
    assert.equal(convict.accessTokens.jwtSecret, '');
    assert.equal(persistCalls, 1);
    assert.equal(syncCalls, 0);
  });

  it('empty read-back after persist rejects without publishing the candidate', async () => {
    const convict = emptyConfig();
    let persistCalls = 0;
    let syncCalls = 0;
    await assert.rejects(
      () =>
        reconcileSharedAccessTokenJwtSecret(convict, {
          configInitialized: false,
          readPersisted: async () => ({ ok: true, config: null }),
          syncConfig: () => {
            syncCalls += 1;
          },
          persistOverride: async () => {
            persistCalls += 1;
          },
          withLock: async (_resource, _ttl, fn) => fn(),
        }),
      isUnavailable,
    );
    assert.equal(convict.accessTokens.jwtSecret, '');
    assert.equal(persistCalls, 1);
    assert.equal(syncCalls, 0);
  });

  it('successful read-back syncs the verified secret once', async () => {
    const persist = { current: null as AuthConfig | null };
    const convict = emptyConfig();
    let syncCalls = 0;
    await reconcileSharedAccessTokenJwtSecret(convict, {
      configInitialized: false,
      readPersisted: async () => ({ ok: true, config: persist.current }),
      syncConfig: config => {
        syncCalls += 1;
        convict.accessTokens.jwtSecret = config.accessTokens.jwtSecret;
      },
      persistOverride: async config => {
        persist.current = {
          accessTokens: { jwtSecret: config.accessTokens.jwtSecret },
          active: config.active,
        };
      },
      withLock: async (_resource, _ttl, fn) => fn(),
    });
    assert.equal(syncCalls, 1);
    assert.ok(convict.accessTokens.jwtSecret?.trim());
    assert.equal(convict.accessTokens.jwtSecret, persist.current?.accessTokens.jwtSecret);
  });

  it('adopts a different peer value from the persist read-back', async () => {
    const convict = emptyConfig();
    let persistCalls = 0;
    await reconcileSharedAccessTokenJwtSecret(convict, {
      configInitialized: false,
      readPersisted: async () =>
        persistCalls === 0
          ? { ok: true, config: null }
          : { ok: true, config: { accessTokens: { jwtSecret: 'peer-won' } } },
      syncConfig: config => {
        convict.accessTokens.jwtSecret = config.accessTokens.jwtSecret;
      },
      persistOverride: async () => {
        persistCalls += 1;
      },
      withLock: async (_resource, _ttl, fn) => fn(),
    });
    assert.equal(persistCalls, 1);
    assert.equal(convict.accessTokens.jwtSecret, 'peer-won');
  });

  it('activation PATCH uses update semantics and keeps persist', async () => {
    const convict = { accessTokens: { jwtSecret: 'S3CR3T' }, active: true };
    let persistCalls = 0;
    await reconcileSharedAccessTokenJwtSecret(convict, {
      configInitialized: true,
      readPersisted: async () => ({
        ok: true,
        config: { accessTokens: { jwtSecret: 'S3CR3T' } },
      }),
      syncConfig: config => {
        convict.accessTokens.jwtSecret = config.accessTokens.jwtSecret;
      },
      persistOverride: async () => {
        persistCalls += 1;
      },
      withLock: async () => {
        throw new Error('lock should not run');
      },
    });
    assert.equal(convict.accessTokens.jwtSecret, 'S3CR3T');
    assert.equal(persistCalls, 0);
  });
});
