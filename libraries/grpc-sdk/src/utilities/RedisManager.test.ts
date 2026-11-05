import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { Cluster, Redis } from 'ioredis';
import { getRedisKeyPrefix, RedisManager, withRedisKeyPrefix } from './RedisManager.js';

const clients: (Redis | Cluster)[] = [];
function track<T extends Redis | Cluster>(client: T): T {
  clients.push(client);
  client.on('error', () => {});
  return client;
}
after(() => clients.forEach(c => c.disconnect()));
const kp = (c: Redis | Cluster) => c.options.keyPrefix ?? '';

const standalone = (keyPrefix?: string) =>
  new RedisManager({
    host: '127.0.0.1',
    port: 1,
    lazyConnect: true,
    ...(keyPrefix !== undefined ? { keyPrefix } : {}),
  });
const cluster = (keyPrefix?: string) =>
  new RedisManager({
    nodes: [{ host: '127.0.0.1', port: 1 }],
    options: { lazyConnect: true, ...(keyPrefix ? { keyPrefix } : {}) },
  });

describe('RedisManager key prefix', () => {
  it('keeps today’s behaviour when no global prefix is set', () => {
    const m = standalone();
    assert.equal(m.prefix, '');
    assert.equal(kp(track(m.getClient())), '');
    assert.equal(kp(track(m.getClient({ keyPrefix: 'bus_' }))), 'bus_');
    assert.equal(m.bullMQPrefix, 'bull');
  });

  it('composes global and per-client prefixes (standalone)', () => {
    const m = standalone('tenant-a:');
    assert.equal(m.prefix, 'tenant-a:');
    assert.equal(kp(track(m.getClient())), 'tenant-a:');
    assert.equal(kp(track(m.getClient({ keyPrefix: 'bus_' }))), 'tenant-a:bus_');
    // the global prefix is not left in the shared connection options
    assert.equal((m.redisConnection as { keyPrefix?: string }).keyPrefix, undefined);
  });

  it('composes global and per-client prefixes (cluster)', () => {
    const m = cluster('tenant-a:');
    assert.equal(m.prefix, 'tenant-a:');
    const c = track(m.getClient({ keyPrefix: 'auth_metrics_' })) as Cluster;
    assert.equal(kp(c), 'tenant-a:auth_metrics_');
    assert.equal(kp(track(m.getClient())), 'tenant-a:');
  });

  it('accepts a top-level keyPrefix in cluster details', () => {
    const m = new RedisManager({
      nodes: [{ host: '127.0.0.1', port: 1 }],
      options: { lazyConnect: true },
      keyPrefix: 'tenant-b:',
    });
    assert.equal(m.prefix, 'tenant-b:');
  });

  it('gives BullMQ an unprefixed client and the prefix through its own option', () => {
    for (const m of [standalone('tenant-a:'), cluster('tenant-a:')]) {
      const { connection, prefix } = m.getBullMQOptions();
      track(connection);
      assert.equal(kp(connection), '');
      assert.equal(prefix, 'tenant-a:bull');
      assert.equal(kp(track(m.getUnprefixedClient())), '');
    }
  });

  it('withRedisKeyPrefix / getRedisKeyPrefix round-trip', () => {
    assert.deepEqual(withRedisKeyPrefix({ host: 'h' }, undefined), { host: 'h' });
    assert.deepEqual(withRedisKeyPrefix({ host: 'h' }, ''), { host: 'h' });
    const s = withRedisKeyPrefix({ host: 'h', keyPrefix: 'old:' }, 'new:');
    assert.equal(getRedisKeyPrefix(s), 'new:');
    const c = withRedisKeyPrefix(
      { nodes: [{ host: 'h', port: 1 }], options: {}, keyPrefix: 'old:' },
      'new:',
    );
    assert.deepEqual(c, {
      nodes: [{ host: 'h', port: 1 }],
      options: { keyPrefix: 'new:' },
    });
    assert.equal(getRedisKeyPrefix(c), 'new:');
  });
});
