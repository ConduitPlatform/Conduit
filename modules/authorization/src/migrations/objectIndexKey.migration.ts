import { ObjectIndex } from '../models/index.js';
import { objectIndexRowKey } from '../utils/index.js';

const BATCH_SIZE = 500;

/**
 * Fills `key` on rows written before it existed, deleting a row instead when its key
 * is already taken (a duplicate the old read-then-insert path let through). Rows
 * without a key are outside the unique index (sparse on Mongo, NULL on SQL), so this
 * can run after the index exists. Idempotent: each pass only sees rows still unset.
 */
export async function backfillObjectIndexKeys() {
  const model = ObjectIndex.getInstance();
  let previousFirst: string | undefined;
  for (;;) {
    // a missing field on Mongo, NULL on SQL
    const rows = await model.findMany(
      { key: { $exists: false } },
      undefined,
      0,
      BATCH_SIZE,
      { _id: 1 },
    );
    if (!rows.length) return;
    // Every row of a pass gets a key or is deleted; seeing one again means the
    // writes are not sticking, so stop instead of looping forever.
    if (rows[0]._id === previousFirst) {
      throw new Error('ObjectIndex key backfill made no progress');
    }
    previousFirst = rows[0]._id;

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
    for (const { row, key } of updates) {
      try {
        await model.findByIdAndUpdate(row._id, { key });
      } catch (e) {
        // A connection job inserted the same row (with its key) in the meantime.
        if (!(await model.findOne({ key }))) throw e;
        await model.deleteMany({ _id: row._id });
      }
    }
  }
}
