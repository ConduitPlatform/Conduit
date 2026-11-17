import { ObjectIndex } from '../models/index.js';

/**
 * Inserts ObjectIndex rows (each with its `key`), skipping rows already stored.
 *
 * `ignoreDuplicates` makes this one call on a matching database module. An older
 * database module ignores the option but still builds the unique index, so a row a
 * concurrent writer stored first fails the whole call. Then re-check which keys are
 * stored and insert only the rest: the call succeeds as long as every failure was a
 * duplicate, and any other error is still thrown.
 */
export async function insertObjectIndexRows(
  rows: (Partial<ObjectIndex> & { key: string })[],
): Promise<void> {
  if (!rows.length) return;
  const model = ObjectIndex.getInstance();
  try {
    await model.createMany(rows, { ignoreDuplicates: true });
  } catch (e) {
    const stored = new Set(
      (await model.findMany({ key: { $in: rows.map(row => row.key) } }, 'key')).map(
        row => row.key,
      ),
    );
    const missing = rows.filter(row => !stored.has(row.key));
    // Nothing was a duplicate, so the error was something else.
    if (missing.length === rows.length) throw e;
    // Fewer rows each time, so this ends.
    await insertObjectIndexRows(missing);
  }
}
