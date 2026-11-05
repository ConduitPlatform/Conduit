import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { UserCache, USER_CACHE_PREFIX } from './UserCache.js';
import { fakeRedisManager } from './FakeRedis.testutil.js';

function setup() {
  const { manager, clients } = fakeRedisManager();
  return { cache: new UserCache(manager), client: clients[0] };
}

describe('UserCache', () => {
  it('builds the auth_user_ key itself and requests the client without keyPrefix', async () => {
    const { cache, client } = setup();
    assert.equal(client.keyPrefix, '');
    await cache.set('u1', { email: 'a@b.c' });
    assert.ok(client.store.has('auth_user_u1'));
    assert.equal(USER_CACHE_PREFIX, 'auth_user_');
  });

  it('treats a corrupt entry as a miss', async () => {
    const { cache, client } = setup();
    await client.set('auth_user_u1', '{not json');
    assert.equal(await cache.get('u1'), null);
  });

  it('times out as a miss / no-op when redis never answers', async () => {
    const { cache, client } = setup();
    client.hanging = true;
    const started = Date.now();
    assert.equal(await cache.get('u1'), null);
    await cache.set('u1', { a: 1 });
    await cache.invalidate('u1');
    await cache.invalidateMany(['u1', 'u2']);
    assert.ok(Date.now() - started < 3000);
  });

  it('attaches an error listener to its client', () => {
    const { client } = setup();
    assert.equal(client.handlers['error']?.length, 1);
  });

  it('invalidates more than one chunk of ids', async () => {
    const { cache } = setup();
    const ids = Array.from({ length: 250 }, (_, i) => `u${i}`);
    for (const id of ids) await cache.set(id, { id });
    await cache.invalidateMany(ids);
    assert.equal(await cache.get('u0'), null);
    assert.equal(await cache.get('u249'), null);
  });

  it('round-trips a user and misses unknown ids', async () => {
    const { cache } = setup();
    await cache.set('u1', { email: 'a@b.c', active: true });
    assert.deepEqual(await cache.get('u1'), { email: 'a@b.c', active: true });
    assert.equal(await cache.get('nope'), null);
  });

  it('expires entries after 5000 ms', async () => {
    const { cache, client } = setup();
    let now = 1_000;
    client.now = () => now;
    await cache.set('u1', { a: 1 });
    now += 4_999;
    assert.deepEqual(await cache.get('u1'), { a: 1 });
    now += 2;
    assert.equal(await cache.get('u1'), null);
  });

  it('invalidates one and many', async () => {
    const { cache } = setup();
    await cache.set('u1', { a: 1 });
    await cache.set('u2', { a: 2 });
    await cache.set('u3', { a: 3 });
    await cache.invalidate('u1');
    assert.equal(await cache.get('u1'), null);
    await cache.invalidateMany(['u2', 'u3']);
    assert.equal(await cache.get('u2'), null);
    assert.equal(await cache.get('u3'), null);
    await cache.invalidateMany([]);
  });

  it('is a passthrough when redis fails', async () => {
    const { cache, client } = setup();
    client.failing = true;
    assert.equal(await cache.get('u1'), null);
    await cache.set('u1', { a: 1 });
    await cache.invalidate('u1');
    await cache.invalidateMany(['u1']);
  });
});
