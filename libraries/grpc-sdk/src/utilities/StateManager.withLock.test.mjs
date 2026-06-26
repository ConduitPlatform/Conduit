import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

test('StateManager defines withLock helper', () => {
  const source = readFileSync(join(here, 'StateManager.ts'), 'utf8');
  assert.match(source, /async withLock</);
  assert.match(source, /async tryAcquireLock/);
  assert.match(source, /retryCount: 0/);
  assert.match(source, /finally\s*\{[\s\S]*releaseLock/);
});

test('tryAcquireLock returns null on contention', async () => {
  const { ExecutionError } = await import('@sesamecare-oss/redlock');
  const manager = {
    redLock: {
      async acquire(_resources, _ttl, settings) {
        if (settings?.retryCount === 0) {
          throw new ExecutionError('contended', []);
        }
        return { release: async () => {} };
      },
    },
    async tryAcquireLock(resource, ttl) {
      const { ExecutionError, ResourceLockedError } = await import(
        '@sesamecare-oss/redlock'
      );
      try {
        return await this.redLock.acquire([resource], ttl, { retryCount: 0 });
      } catch (error) {
        if (
          error instanceof ExecutionError ||
          error instanceof ResourceLockedError
        ) {
          return null;
        }
        throw error;
      }
    },
  };

  const lock = await manager.tryAcquireLock('view:test', 1000);
  assert.equal(lock, null);
});

test('withLock pattern releases lock after callback failure', async () => {
  const releases = [];
  const manager = {
    async acquireLock() {
      return { release: async () => releases.push('released') };
    },
    async releaseLock(lock) {
      await lock.release();
    },
    async withLock(_resource, _ttl, fn) {
      const lock = await this.acquireLock();
      try {
        return await fn();
      } finally {
        await this.releaseLock(lock);
      }
    },
  };

  await assert.rejects(
    manager.withLock('view:test', 1000, async () => {
      throw new Error('create failed');
    }),
    /create failed/,
  );
  assert.deepEqual(releases, ['released']);
});
