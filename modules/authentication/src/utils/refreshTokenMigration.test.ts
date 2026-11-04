import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  legacyRefreshDefaults,
  legacyRowPatch,
  migrateLegacyRefreshRows,
  RefreshRowStore,
} from './refreshTokenMigration.js';
import { hashRefreshToken } from './refreshToken.logic.js';
import { createFakeDatabase, matches } from './fakeDatabase.testutil.js';

const DAY = 86_400_000;
const schemaDefaults = { expiryPeriod: 7 * DAY, extendable: true, maxLifetime: 30 * DAY };

function store(rows: any[], opts: { failIds?: string[]; noopUpdate?: boolean } = {}) {
  const updates: string[] = [];
  const s: RefreshRowStore = {
    async findMany(query, options) {
      return rows
        .filter(r => matches(r, query))
        .slice(0, options?.limit ?? 1000)
        .map(r => ({ ...r }));
    },
    async findByIdAndUpdate(id, doc) {
      updates.push(id);
      if (opts.noopUpdate || opts.failIds?.includes(id)) return null;
      Object.assign(
        rows.find(r => r._id === id)!,
        doc,
      );
      return { _id: id };
    },
    async deleteOne(query) {
      const i = rows.findIndex(r => matches(r, query));
      if (i >= 0) rows.splice(i, 1);
      return { deletedCount: i >= 0 ? 1 : 0 };
    },
  };
  return { s, updates };
}

describe('legacyRefreshDefaults', () => {
  it('clamps the default maxLifetime up to a longer expiryPeriod', () => {
    const d = legacyRefreshDefaults({ expiryPeriod: 90 * DAY }, schemaDefaults);
    assert.equal(d.maxLifetime, 90 * DAY);
    assert.equal(
      legacyRefreshDefaults(
        { expiryPeriod: 1 * DAY, maxLifetime: 5 * DAY },
        schemaDefaults,
      ).maxLifetime,
      5 * DAY,
    );
    assert.equal(legacyRefreshDefaults(undefined, schemaDefaults).maxLifetime, 30 * DAY);
  });
});

describe('migrateLegacyRefreshRows', () => {
  const defaults = { extendable: true, maxLifetime: 30 * DAY };
  it('hashes plaintext rows, sets caps, clears the token and is idempotent', async () => {
    const created = new Date('2026-01-01T00:00:00Z');
    const rows: any[] = [
      { _id: 'a', token: 'tok-a', createdAt: created, expiresOn: new Date() },
      { _id: 'b', createdAt: created },
      { _id: 'c', tokenHash: 'already', createdAt: created },
    ];
    const { s } = store(rows);
    const res = await migrateLegacyRefreshRows(s, defaults);
    assert.deepEqual(res, { migrated: 1, deleted: 1, unmigrated: 0 });
    assert.equal(rows.length, 2);
    const a = rows.find(r => r._id === 'a');
    assert.equal(a.tokenHash, hashRefreshToken('tok-a'));
    assert.equal(a.token, null);
    assert.equal(a.issuedAt.getTime(), created.getTime());
    assert.equal(a.maxExpiresOn.getTime(), created.getTime() + 30 * DAY);
    assert.deepEqual(await migrateLegacyRefreshRows(s, defaults), {
      migrated: 0,
      deleted: 0,
      unmigrated: 0,
    });
  });
  it('terminates when updates do not persist and reports the unmigrated rows', async () => {
    const rows: any[] = [
      { _id: 'a', token: 't1' },
      { _id: 'b', token: 't2' },
    ];
    const { s, updates } = store(rows, { noopUpdate: true });
    const res = await migrateLegacyRefreshRows(s, defaults);
    assert.equal(res.migrated, 0);
    assert.equal(res.unmigrated, 2);
    assert.equal(updates.length, 2);
  });
  it('keeps going past failing rows and counts only changed ones', async () => {
    const rows: any[] = [
      { _id: 'bad', token: 'x' },
      { _id: 'ok1', token: 'y' },
      { _id: 'ok2', token: 'z' },
    ];
    const { s } = store(rows, { failIds: ['bad'] });
    const res = await migrateLegacyRefreshRows(s, defaults, 1);
    assert.deepEqual(res, { migrated: 2, deleted: 0, unmigrated: 1 });
  });
  it('patch shape', () => {
    const p = legacyRowPatch({ _id: 'a', token: 't', createdAt: new Date(0) }, defaults);
    assert.equal(p.token, null);
  });
  it('works against the fake database too', () => {
    assert.ok(createFakeDatabase().database);
  });
});
