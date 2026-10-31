import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Redis, RedisOptions } from 'ioredis';
import { RedisManager } from './RedisManager.js';
import { StateManager } from './StateManager.js';

// Runs against a real Redis when REDIS_URL is set, e.g. REDIS_URL=redis://localhost:6379
const redisUrl = process.env.REDIS_URL;

describe(
  'StateManager.consumeKeyIfMatches',
  { skip: !redisUrl && 'REDIS_URL not set' },
  () => {
    let client: Redis;
    let state: StateManager;
    let exitHandlers: NodeJS.ExitListener[];
    const code = '{tag}';
    const attempts = '{tag}:attempts';

    before(() => {
      const manager = {
        getClient: (options?: RedisOptions) => {
          client = new Redis(redisUrl!, options ?? {});
          return client;
        },
      } as unknown as RedisManager;
      const existing = process.listeners('exit');
      state = new StateManager(manager, `state-test-${process.pid}`);
      // the StateManager quits its client on exit; the test closes it itself
      exitHandlers = process.listeners('exit').filter(l => !existing.includes(l));
    });

    beforeEach(async () => {
      await state.clearKey(code);
      await state.clearKey(attempts);
    });

    after(async () => {
      exitHandlers.forEach(handler => process.off('exit', handler));
      await client.quit();
    });

    it('consumes a matching value once', async () => {
      await state.setKey(code, '123456', 60_000);
      const results = await Promise.all([
        state.consumeKeyIfMatches(code, attempts, '123456', 5),
        state.consumeKeyIfMatches(code, attempts, '123456', 5),
      ]);
      assert.deepEqual(results.sort(), [false, true]);
      assert.equal(await state.getKey(code), null);
    });

    it('keeps the value on a mismatch and counts the attempt with the same expiry', async () => {
      await state.setKey(code, '123456', 60_000);
      assert.equal(await state.consumeKeyIfMatches(code, attempts, '000000', 5), false);
      assert.equal(await state.getKey(code), '123456');
      assert.equal(await state.getKey(attempts), '1');
      const ttl = await client.pttl(attempts);
      assert.ok(ttl > 0 && ttl <= 60_000, `attempts ttl ${ttl}`);
      assert.equal(await state.consumeKeyIfMatches(code, attempts, '123456', 5), true);
      assert.equal(await state.getKey(attempts), null);
    });

    it('deletes the value after the last allowed mismatch', async () => {
      await state.setKey(code, '123456', 60_000);
      for (let i = 0; i < 4; i += 1) {
        assert.equal(await state.consumeKeyIfMatches(code, attempts, '000000', 5), false);
      }
      assert.equal(await state.getKey(code), '123456');
      assert.equal(await state.consumeKeyIfMatches(code, attempts, '000000', 5), false);
      assert.equal(await state.getKey(code), null);
      assert.equal(await state.getKey(attempts), null);
      assert.equal(await state.consumeKeyIfMatches(code, attempts, '123456', 5), false);
    });

    it('does nothing for a missing key', async () => {
      assert.equal(await state.consumeKeyIfMatches(code, attempts, '123456', 5), false);
      assert.equal(await state.getKey(attempts), null);
    });
  },
);
