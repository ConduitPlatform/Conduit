import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { Cluster, Redis } from 'ioredis';
import { RedisManager, withRedisKeyPrefix } from './RedisManager.js';

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
    const conn = track(m.getUnprefixedClient());
    assert.equal(m.bullMQOptions(conn).prefix, 'bull');
  });

  it('composes global and per-client prefixes (standalone)', () => {
    const m = standalone('tenant-a:');
    assert.equal(m.prefix, 'tenant-a:');
    assert.equal(kp(track(m.getClient())), 'tenant-a:');
    assert.equal(kp(track(m.getClient({ keyPrefix: 'bus_' }))), 'tenant-a:bus_');
    assert.equal((m.redisConnection as { keyPrefix?: string }).keyPrefix, undefined);
  });

  it('composes global and per-client prefixes (cluster)', () => {
    const m = cluster('tenant-a:');
    assert.equal(m.prefix, 'tenant-a:');
    const c = track(m.getClient({ keyPrefix: 'auth_metrics_' })) as Cluster;
    assert.equal(kp(c), 'tenant-a:auth_metrics_');
    assert.equal(kp(track(m.getClient())), 'tenant-a:');
  });

  it('gives BullMQ an unprefixed client and the prefix through its own option', () => {
    const m = standalone('tenant-a:');
    const conn = track(m.getUnprefixedClient());
    assert.equal(kp(conn), '');
    assert.deepEqual(m.bullMQOptions(conn), {
      connection: conn,
      prefix: 'tenant-a:bull',
    });
  });

  it('hash-tags the BullMQ prefix on a cluster', () => {
    const conn = track(cluster('tenant-a:').getUnprefixedClient());
    assert.equal(cluster('tenant-a:').bullMQOptions(conn).prefix, '{tenant-a:bull}');
    assert.equal(cluster().bullMQOptions(conn).prefix, '{bull}');
  });

  it('appends a separator to a prefix without one', () => {
    assert.equal(standalone('app').prefix, 'app:');
    assert.equal(cluster('app').prefix, 'app:');
    assert.equal(standalone('app:').prefix, 'app:');
  });

  it('passes caller options and maxRetriesPerRequest to cluster nodes', () => {
    const c = track(cluster('tenant-a:').getClient({ connectionName: 'x' })) as Cluster;
    assert.equal(c.options.redisOptions?.connectionName, 'x');
    assert.equal(c.options.redisOptions?.maxRetriesPerRequest, null);
  });

  it('withRedisKeyPrefix sets the prefix RedisManager reads', () => {
    assert.deepEqual(withRedisKeyPrefix({ host: 'h' }, undefined), { host: 'h' });
    assert.deepEqual(withRedisKeyPrefix({ host: 'h' }, ''), { host: 'h' });
    const s = withRedisKeyPrefix(
      { host: 'h', keyPrefix: 'old:', lazyConnect: true },
      'new:',
    );
    assert.equal(new RedisManager(s).prefix, 'new:');
    const c = withRedisKeyPrefix(
      { nodes: [{ host: 'h', port: 1 }], options: {} },
      'new:',
    );
    assert.deepEqual(c, {
      nodes: [{ host: 'h', port: 1 }],
      options: { keyPrefix: 'new:' },
    });
    assert.equal(new RedisManager(c).prefix, 'new:');
  });
});
