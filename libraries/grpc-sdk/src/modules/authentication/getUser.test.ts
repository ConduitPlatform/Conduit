import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { status } from '@grpc/grpc-js';
import { Authentication } from './index.js';
import { UserCache } from '../../utilities/UserCache.js';
import { fakeRedisManager } from '../../utilities/FakeRedis.testutil.js';

function setup(response: { user: string } = { user: '{"_id":"u1","email":"a@b.c"}' }) {
  const auth = new Authentication('test', 'localhost:0');
  const calls: string[] = [];
  Object.defineProperty(auth, 'client', {
    get: () => ({
      getUser: async ({ userId }: { userId: string }) => {
        calls.push(userId);
        return response;
      },
    }),
  });
  const { manager, clients } = fakeRedisManager();
  const cache = new UserCache(manager);
  return { auth, calls, cache, redis: clients[0] };
}

describe('Authentication.getUser', () => {
  it('passes through without a cache', async () => {
    const { auth, calls } = setup();
    assert.deepEqual(await auth.getUser('u1'), { _id: 'u1', email: 'a@b.c' });
    assert.deepEqual(calls, ['u1']);
  });

  it('a cache hit skips the rpc', async () => {
    const { auth, calls, cache } = setup();
    auth.attachUserCache(cache);
    await cache.set('u1', { _id: 'u1', cached: true });
    assert.deepEqual(await auth.getUser('u1'), { _id: 'u1', cached: true });
    assert.deepEqual(calls, []);
  });

  it('a miss populates the cache', async () => {
    const { auth, calls, cache } = setup();
    auth.attachUserCache(() => cache);
    await auth.getUser('u1');
    await new Promise(r => setImmediate(r));
    assert.deepEqual(await cache.get('u1'), { _id: 'u1', email: 'a@b.c' });
    await auth.getUser('u1');
    assert.deepEqual(calls, ['u1']);
  });

  it('a lazy provider returning undefined is a passthrough', async () => {
    const { auth, calls } = setup();
    auth.attachUserCache(() => undefined);
    await auth.getUser('u1');
    assert.deepEqual(calls, ['u1']);
  });

  it('still returns the rpc result when redis never answers', async () => {
    const { auth, cache, redis } = setup();
    auth.attachUserCache(cache);
    redis.hanging = true;
    assert.deepEqual(await auth.getUser('u1'), { _id: 'u1', email: 'a@b.c' });
  });

  it('treats corrupt cached JSON as a miss', async () => {
    const { auth, calls, cache, redis } = setup();
    auth.attachUserCache(cache);
    await redis.set('auth_user_u1', '{broken');
    assert.deepEqual(await auth.getUser('u1'), { _id: 'u1', email: 'a@b.c' });
    assert.deepEqual(calls, ['u1']);
  });

  it('turns an empty response into NOT_FOUND', async () => {
    const { auth } = setup({ user: '' });
    await assert.rejects(auth.getUser('ghost'), (e: any) => e.code === status.NOT_FOUND);
  });
});
