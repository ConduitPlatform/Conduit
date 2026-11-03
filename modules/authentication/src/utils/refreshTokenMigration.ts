import { hashRefreshToken, refreshMaxExpiresOn } from './refreshToken.logic.js';
import { clampRefreshMaxLifetime } from './sessionConfig.logic.js';

export type LegacyRefreshDefaults = { extendable: boolean; maxLifetime: number };

export type LegacyRefreshRow = {
  _id: string;
  token?: string | null;
  createdAt?: Date | string | number;
  expiresOn?: Date | string | number;
};

/** The minimal model surface the migration needs (a fake in tests). */
export interface RefreshRowStore {
  findMany(query: any, options?: any): Promise<LegacyRefreshRow[]>;
  findByIdAndUpdate(id: string, doc: any): Promise<unknown | null>;
  deleteOne(query: any): Promise<{ deletedCount?: number } | unknown>;
}

/**
 * Global refresh defaults for legacy rows from the (stored) config. maxLifetime is
 * clamped up to the expiryPeriod, so the default 30 days never lands below an old
 * install's longer expiry.
 */
export function legacyRefreshDefaults(
  refresh:
    | { expiryPeriod?: unknown; extendable?: unknown; maxLifetime?: unknown }
    | null
    | undefined,
  schemaDefaults: { expiryPeriod: number; extendable: boolean; maxLifetime: number },
): LegacyRefreshDefaults {
  const expiryPeriod =
    typeof refresh?.expiryPeriod === 'number'
      ? refresh.expiryPeriod
      : schemaDefaults.expiryPeriod;
  const maxLifetime =
    typeof refresh?.maxLifetime === 'number'
      ? refresh.maxLifetime
      : schemaDefaults.maxLifetime;
  return {
    extendable:
      typeof refresh?.extendable === 'boolean'
        ? refresh.extendable
        : schemaDefaults.extendable,
    maxLifetime:
      clampRefreshMaxLifetime({ expiryPeriod, maxLifetime }).maxLifetime ?? maxLifetime,
  };
}

/** The update that turns a legacy plaintext row into a hashed one. */
export function legacyRowPatch(row: LegacyRefreshRow, defaults: LegacyRefreshDefaults) {
  const issuedAt = new Date(row.createdAt ?? row.expiresOn ?? Date.now());
  return {
    tokenHash: hashRefreshToken(String(row.token)),
    issuedAt,
    extendable: defaults.extendable,
    maxExpiresOn: refreshMaxExpiresOn(issuedAt, defaults.maxLifetime),
    token: null,
  };
}

export type RefreshMigrationResult = {
  migrated: number;
  deleted: number;
  /** rows whose update did not persist; they are left as they are */
  unmigrated: number;
};

/**
 * Hashes every legacy row. Each update's result is checked and progress is counted by
 * rows actually changed; a row whose update did not persist is excluded from later
 * batches, so a non-persisting update cannot loop forever. Rows with neither a hash nor a
 * token can never be presented again and are removed. Idempotent.
 */
export async function migrateLegacyRefreshRows(
  store: RefreshRowStore,
  defaults: LegacyRefreshDefaults,
  batchSize = 500,
): Promise<RefreshMigrationResult> {
  const result: RefreshMigrationResult = { migrated: 0, deleted: 0, unmigrated: 0 };
  const failed = new Set<string>();
  const handled = new Set<string>();
  const updatedIds = new Set<string>();
  for (;;) {
    const query: Record<string, unknown> = { tokenHash: null };
    if (failed.size > 0) query._id = { $nin: [...failed] };
    const batch = await store.findMany(query, { select: '+token', limit: batchSize });
    if (batch.length === 0) break;
    if (batch.every(r => failed.has(String(r._id)))) break;
    for (const row of batch) {
      const id = String(row._id);
      // read again after being handled: its update did not really persist
      if (handled.has(id)) {
        failed.add(id);
        if (result.migrated > 0 && updatedIds.has(id)) {
          result.migrated -= 1;
          updatedIds.delete(id);
        }
        continue;
      }
      handled.add(id);
      try {
        if (!row.token) {
          await store.deleteOne({ _id: id });
          result.deleted += 1;
          continue;
        }
        const updated = await store.findByIdAndUpdate(id, legacyRowPatch(row, defaults));
        if (updated) {
          result.migrated += 1;
          updatedIds.add(id);
        } else {
          failed.add(id);
        }
      } catch {
        failed.add(id);
      }
    }
    // every row is handled once: persisted rows leave the query, failed ones are excluded
  }
  result.unmigrated = failed.size;
  return result;
}
