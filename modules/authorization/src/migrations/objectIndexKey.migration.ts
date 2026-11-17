import { ObjectIndex } from '../models/index.js';
import { objectIndexRowKey } from '../utils/index.js';

const BATCH_SIZE = 500;
const CONCURRENCY = 50;

/**
 * Fills `key` on rows written before it existed, deleting a row instead when its key
 * is already taken (a duplicate the old read-then-insert path let through).
 *
 * Runs in the background once the module is serving (see `Authorization.onConfig`):
 * readers never use `key`, and a job that inserts the keyed twin of a legacy row
 * only leaves a duplicate this loop then deletes. Rows without a key are outside the
 * unique index (sparse on Mongo, NULL on SQL), so it can run after the index exists.
 *
 * Pages forward by `_id`, so each row is read once: the sparse `key` index cannot
 * answer `$exists: false`, and restarting from the first row on every batch would
 * re-read every row already filled.
 */
export async function backfillObjectIndexKeys() {
  const model = ObjectIndex.getInstance();
  let lastId: string | undefined;
  for (;;) {
    const rows = await model.findMany(
      {
        // a missing field on Mongo, NULL on SQL
        key: { $exists: false },
        ...(lastId ? { _id: { $gt: lastId } } : {}),
      },
      undefined,
      0,
      BATCH_SIZE,
      { _id: 1 },
    );
    if (!rows.length) return;
    lastId = rows[rows.length - 1]._id;

    const keyed = rows.map(row => ({ row, key: objectIndexRowKey(row) }));
    const taken = new Set(
      (
        await model.findMany({ key: { $in: [...new Set(keyed.map(i => i.key))] } }, 'key')
      ).map(row => row.key),
    );
    const duplicates: string[] = [];
    const updates: { row: ObjectIndex; key: string }[] = [];
    for (const item of keyed) {
      if (taken.has(item.key)) {
        duplicates.push(item.row._id);
      } else {
        // the first row of the batch claims the key; later copies are duplicates
        taken.add(item.key);
        updates.push(item);
      }
    }
    if (duplicates.length) {
      await model.deleteMany({ _id: { $in: duplicates } });
    }
    // Keys within a batch are distinct, so these writes cannot conflict with each other.
    for (let i = 0; i < updates.length; i += CONCURRENCY) {
      await Promise.all(updates.slice(i, i + CONCURRENCY).map(claimKey));
    }
    if (rows.length < BATCH_SIZE) return;
  }
}

async function claimKey({ row, key }: { row: ObjectIndex; key: string }) {
  const model = ObjectIndex.getInstance();
  try {
    await model.findByIdAndUpdate(row._id, { key });
  } catch (e) {
    // A connection job inserted the same row (with its key) in the meantime.
    if (!(await model.findOne({ key }))) throw e;
    await model.deleteMany({ _id: row._id });
  }
}
