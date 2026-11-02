import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { RedisManager } from './RedisManager.js';
import { StateManager } from './StateManager.js';

const redisUrl = process.env.REDIS_URL;

describe('StateManager.setIfAbsent', () => {
  const clients: { quit: () => Promise<unknown> }[] = [];

  after(async () => {
    await Promise.all(clients.map(client => client.quit()));
  });

  it(
    'returns true then false and sets a TTL',
    { skip: redisUrl ? false : 'REDIS_URL is not set' },
    async () => {
      const parsed = new URL(redisUrl!);
      const manager = new RedisManager({
        host: parsed.hostname,
        port: Number(parsed.port || 6379),
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        db: parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : undefined,
      });
      const state = new StateManager(manager, 'sigtest');
      const probe = manager.getClient();
      clients.push(probe);
      const key = `set-if-absent-${Date.now()}`;
      try {
        assert.equal(await state.setIfAbsent(key, '1', 300000), true);
        assert.equal(await state.setIfAbsent(key, '1', 300000), false);
        const ttl = await probe.pttl(`sigtest_${key}`);
        assert.equal(ttl > 0 && ttl <= 300000, true);
      } finally {
        await state.clearKey(key);
      }
    },
  );
});
