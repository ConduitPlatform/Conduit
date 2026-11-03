import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SessionRegistry } from './SessionRegistry.js';
import { fakeRedisManager } from './FakeRedis.testutil.js';

function setup() {
  const { manager, clients } = fakeRedisManager();
  return { registry: new SessionRegistry(manager), client: clients[0] };
}

const data = { user: 'u1', clientId: 'c1', realm: 'r1' };

describe('SessionRegistry', () => {
  it('registers under auth_session_<sid>, requesting the client without keyPrefix', async () => {
    const { registry, client } = setup();
    assert.equal(client.keyPrefix, '');
    await registry.register('s1', data, 1000);
    assert.deepEqual(JSON.parse(client.store.get('auth_session_s1')!.value), data);
    assert.equal(await registry.exists('s1'), true);
    assert.equal(await registry.exists('s2'), false);
  });

  it('stores a missing realm as null', async () => {
    const { registry, client } = setup();
    await registry.register('s1', { user: 'u1', clientId: 'c1' }, 1000);
    assert.equal(JSON.parse(client.store.get('auth_session_s1')!.value).realm, null);
  });

  it('expires after the ttl', async () => {
    const { registry, client } = setup();
    let now = 0;
    client.now = () => now;
    await registry.register('s1', data, 1000);
    now = 1001;
    assert.equal(await registry.exists('s1'), false);
  });

  it('touch extends a live session and ignores an unknown one', async () => {
    const { registry, client } = setup();
    let now = 0;
    client.now = () => now;
    await registry.register('s1', data, 1000);
    now = 900;
    await registry.touch('s1', 1000);
    now = 1500;
    assert.equal(await registry.exists('s1'), true);
    await registry.touch('ghost', 1000);
    assert.equal(await registry.exists('ghost'), false);
  });

  it('revokes one and many', async () => {
    const { registry } = setup();
    await registry.register('s1', data, 1000);
    await registry.register('s2', data, 1000);
    await registry.register('s3', data, 1000);
    await registry.revoke('s1');
    assert.equal(await registry.exists('s1'), false);
    await registry.revokeMany(['s2', 's3']);
    assert.equal(await registry.exists('s2'), false);
    assert.equal(await registry.exists('s3'), false);
    await registry.revokeMany([]);
  });

  it('rejects with a clear error on redis failure', async () => {
    const { registry, client } = setup();
    client.failing = true;
    await assert.rejects(registry.revoke('s1'), /Session registry unavailable/);
    await assert.rejects(registry.exists('s1'), /Session registry unavailable/);
  });

  it('rejects with a clear error when redis never answers', async () => {
    const { registry, client } = setup();
    client.hanging = true;
    await assert.rejects(registry.exists('s1'), /Session registry unavailable/);
    await assert.rejects(
      registry.register('s1', data, 1000),
      /Session registry unavailable/,
    );
  });

  it('clamps the ttl to at least 1 ms and rounds up', async () => {
    const { registry, client } = setup();
    const now = 0;
    client.now = () => now;
    await registry.register('s1', data, 0);
    assert.equal(client.store.get('auth_session_s1')!.expiresAt, 1);
    await registry.register('s2', data, 10.2);
    assert.equal(client.store.get('auth_session_s2')!.expiresAt, 11);
  });

  it('revokeMany attempts everything and lists the sids that failed', async () => {
    const { registry, client } = setup();
    const sids = Array.from({ length: 250 }, (_, i) => `s${i}`);
    for (const sid of sids) await registry.register(sid, data, 1000);
    client.failKey = key => key === 'auth_session_s5' || key === 'auth_session_s150';
    await assert.rejects(registry.revokeMany(sids), /s5, s150/);
    assert.equal(await registry.exists('s249'), false);
    assert.equal(await registry.exists('s5'), true);
  });
});
