import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectIndex } from '../models/index.js';
import { constructObjectIndex, objectIndexRowKey } from '../utils/index.js';
import { FakeObjectIndexStore } from '../testing/fakeObjectIndexStore.js';
import { backfillObjectIndexKeys } from './objectIndexKey.migration.js';

const TREE = ['Team:t#owner@Doc:d'];
const inherited = (marker = '') => ({
  ...constructObjectIndex('Doc:d', 'read', 'owner', 'Team:t', TREE),
  entityPermission: marker,
});

describe('backfillObjectIndexKeys', () => {
  const store = new FakeObjectIndexStore();

  beforeEach(() => {
    store.reset();
    mock.method(ObjectIndex, 'getInstance', () => store as unknown as ObjectIndex);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  const assertAllKeyedAndUnique = () => {
    for (const row of store.rows) assert.equal(row.key, objectIndexRowKey(row));
    const keys = store.rows.map(row => row.key);
    assert.equal(new Set(keys).size, keys.length);
  };

  it('fills the key on rows written before it existed', async () => {
    store.seedLegacy([
      constructObjectIndex('Doc:d', 'read', 'owner', 'Doc:d', []),
      inherited('read'),
    ]);

    await backfillObjectIndexKeys();

    assert.equal(store.rows.length, 2);
    assertAllKeyedAndUnique();
  });

  it('keeps one copy of rows the old read-then-insert path duplicated', async () => {
    store.seedLegacy([inherited('read'), inherited('read'), inherited(), inherited()]);

    await backfillObjectIndexKeys();

    // one per marker: `read` and unmarked are different rows
    assert.deepStrictEqual(store.rows.map(row => row.entityPermission).sort(), [
      '',
      'read',
    ]);
    assertAllKeyedAndUnique();
  });

  it('drops a legacy copy of a row that already has its key', async () => {
    store.seed([inherited('read')]);
    store.seedLegacy([inherited('read')]);

    await backfillObjectIndexKeys();

    assert.equal(store.rows.length, 1);
    assertAllKeyedAndUnique();
  });

  it('drops the legacy row when a job stores the same row while it runs', async () => {
    store.seedLegacy([inherited('read')]);
    // A connection job inserts the keyed row right after the migration's key lookup.
    let raced = false;
    store.afterFind = async query => {
      const lookup = (query.key as { $in?: unknown[] } | undefined)?.$in;
      if (!raced && lookup) {
        raced = true;
        await store.createMany([
          { ...inherited('read'), key: objectIndexRowKey(inherited('read')) },
        ]);
      }
    };

    await backfillObjectIndexKeys();

    assert.equal(store.rows.length, 1);
    assertAllKeyedAndUnique();
  });

  it('pages through more rows than one batch', async () => {
    store.seedLegacy(
      Array.from({ length: 1201 }, (_, i) =>
        constructObjectIndex(`Doc:${i}`, 'read', 'owner', `Doc:${i}`, []),
      ),
    );

    await backfillObjectIndexKeys();

    assert.equal(store.rows.length, 1201);
    assertAllKeyedAndUnique();
  });
});
