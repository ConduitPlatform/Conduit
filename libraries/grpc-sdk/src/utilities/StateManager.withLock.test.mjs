import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

test('StateManager defines withLock helper', () => {
  const source = readFileSync(join(here, 'StateManager.ts'), 'utf8');
  assert.match(source, /async withLock</);
  assert.match(source, /finally\s*\{[\s\S]*releaseLock/);
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
