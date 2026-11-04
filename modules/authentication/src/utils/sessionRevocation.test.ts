import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AccessToken, RefreshToken } from '../models/index.js';
import { createFakeDatabase } from './fakeDatabase.testutil.js';
import { createFakeRegistry } from './fakeSession.testutil.js';
import { configureSessionServices, resetSessionServices } from './sessionServices.js';
import { deleteSessionTokens, purgeAllSessionTokens } from './sessionRevocation.js';

const { table, tables, database } = createFakeDatabase();
AccessToken.getInstance(database);
RefreshToken.getInstance(database);

function seed() {
  table('RefreshToken').push(
    { _id: 'rt1', user: 'u1', clientId: 'web', realm: 'r1' },
    { _id: 'rt2', user: 'u1', clientId: 'ios' },
    { _id: 'rt3', user: 'u2', clientId: 'web', realm: 'r1' },
  );
  table('AccessToken').push(
    { _id: 'at1', user: 'u1', clientId: 'web', realm: 'r1', session: 'rt1' },
    { _id: 'at3', user: 'u2', clientId: 'web', realm: 'r1', session: 'rt3' },
  );
}

function withRegistry() {
  const fake = createFakeRegistry();
  configureSessionServices({ registry: () => fake.registry });
  for (const id of ['rt1', 'rt2', 'rt3', 'uuid-1']) {
    fake.entries.set(id, { data: { user: 'x', clientId: 'web' }, ttlMs: 1000 });
  }
  return fake;
}

beforeEach(() => {
  for (const key of Object.keys(tables)) tables[key] = [];
  resetSessionServices();
});

describe('deleteSessionTokens', () => {
  it('deletes the matching rows and revokes exactly their sessions', async () => {
    seed();
    const fake = withRegistry();
    await deleteSessionTokens({ user: 'u1' }, 'test');
    assert.deepEqual(
      table('RefreshToken').map(r => r._id),
      ['rt3'],
    );
    assert.deepEqual(
      table('AccessToken').map(r => r._id),
      ['at3'],
    );
    assert.deepEqual(fake.calls.revokeMany.flat().sort(), ['rt1', 'rt2']);
    assert.deepEqual([...fake.entries.keys()].sort(), ['rt3', 'uuid-1']);
  });
  it('supports $in and realm queries', async () => {
    seed();
    const fake = withRegistry();
    await deleteSessionTokens({ realm: 'r1' }, 'realm');
    assert.deepEqual(fake.calls.revokeMany.flat().sort(), ['rt1', 'rt3']);
    seed();
    await deleteSessionTokens({ user: { $in: ['u1'] } } as any, 'users');
    assert.ok(fake.calls.revokeMany.flat().includes('rt2'));
  });
  it('does not touch the registry when nothing matches', async () => {
    seed();
    const fake = withRegistry();
    await deleteSessionTokens({ user: 'nobody' }, 'none');
    assert.equal(fake.calls.revokeMany.length, 0);
    assert.equal(table('RefreshToken').length, 3);
  });
  it('a registry failure is logged, never fatal, and the rows still go', async () => {
    seed();
    const fake = withRegistry();
    fake.state.failing = true;
    await deleteSessionTokens({ user: 'u1' }, 'test');
    assert.equal(table('RefreshToken').length, 1);
  });
  it('works without any registry', async () => {
    seed();
    await deleteSessionTokens({ user: 'u1' }, 'test');
    assert.equal(table('RefreshToken').length, 1);
  });
});

describe('purgeAllSessionTokens (mode switch)', () => {
  it('deletes every access and refresh token and revokes every session', async () => {
    seed();
    const fake = withRegistry();
    const sessions = await purgeAllSessionTokens('test', new Date(Date.now() + 1000));
    assert.equal(sessions, 3);
    assert.equal(table('RefreshToken').length, 0);
    assert.equal(table('AccessToken').length, 0);
    assert.deepEqual(fake.calls.revokeMany.flat().sort(), ['rt1', 'rt2', 'rt3']);
  });
  it('keeps the sessions created after the switch, even when they appear during the purge', async () => {
    const switchAt = new Date();
    const before = new Date(switchAt.getTime() - 60_000);
    const after = new Date(switchAt.getTime() + 60_000);
    for (let i = 0; i < 600; i++) {
      table('RefreshToken').push({ _id: `old${i}`, user: 'u1', createdAt: before });
      table('AccessToken').push({ _id: `oldat${i}`, user: 'u1', createdAt: before });
    }
    const fake = withRegistry();
    // a login that lands while the first batch is being revoked
    const revokeMany = fake.registry.revokeMany.bind(fake.registry);
    let injected = false;
    fake.registry.revokeMany = async sids => {
      if (!injected) {
        injected = true;
        table('RefreshToken').push({ _id: 'fresh', user: 'u9', createdAt: after });
        table('AccessToken').push({ _id: 'freshat', user: 'u9', createdAt: after });
      }
      return revokeMany(sids);
    };
    const sessions = await purgeAllSessionTokens('test', switchAt);
    assert.equal(sessions, 600);
    assert.deepEqual(
      table('RefreshToken').map(r => r._id),
      ['fresh'],
    );
    assert.deepEqual(
      table('AccessToken').map(r => r._id),
      ['freshat'],
    );
    assert.ok(!fake.calls.revokeMany.flat().includes('fresh'));
  });
  it('rows without a createdAt are purged too', async () => {
    table('RefreshToken').push({ _id: 'legacy', user: 'u1' });
    await purgeAllSessionTokens('test', new Date());
    assert.equal(table('RefreshToken').length, 0);
  });
  it('a delete that removes nothing cannot loop forever', async () => {
    for (let i = 0; i < 500; i++)
      table('RefreshToken').push({ _id: `rt${i}`, user: 'u1' });
    const model = RefreshToken.getInstance();
    const original = model.deleteMany.bind(model);
    let calls = 0;
    model.deleteMany = (async () => {
      calls += 1;
      return { deletedCount: 0 };
    }) as typeof model.deleteMany;
    try {
      await deleteSessionTokens({ user: 'u1' }, 'stuck');
    } finally {
      model.deleteMany = original;
    }
    assert.equal(calls, 1);
  });
  it('works in batches', async () => {
    for (let i = 0; i < 1100; i++) {
      table('RefreshToken').push({ _id: `rt${i}`, user: 'u1' });
      table('AccessToken').push({ _id: `at${i}`, user: 'u1' });
    }
    const fake = withRegistry();
    const sessions = await purgeAllSessionTokens('test', new Date(Date.now() + 1000));
    assert.equal(sessions, 1100);
    assert.equal(table('RefreshToken').length, 0);
    assert.equal(table('AccessToken').length, 0);
    assert.equal(fake.calls.revokeMany.length, 3);
    assert.deepEqual(
      fake.calls.revokeMany.map(b => b.length),
      [500, 500, 100],
    );
  });
  it('survives a failing registry', async () => {
    seed();
    const fake = withRegistry();
    fake.state.failing = true;
    assert.equal(await purgeAllSessionTokens('test', new Date(Date.now() + 1000)), 3);
    assert.equal(table('RefreshToken').length, 0);
  });
});
