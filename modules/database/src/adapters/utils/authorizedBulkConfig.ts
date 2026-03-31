/** Thrown when a bulk would process more authorized IDs than `CONDUIT_AUTHZ_BULK_MAX_TOTAL_IDS`. */
export class AuthzBulkMaxTotalIdsError extends Error {
  readonly code = 'AUTHZ_BULK_MAX_TOTAL_IDS' as const;
  constructor(maxTotal: number) {
    super(
      `Authorized bulk operation would exceed CONDUIT_AUTHZ_BULK_MAX_TOTAL_IDS (${maxTotal}). Narrow your query or raise the limit intentionally.`,
    );
    this.name = 'AuthzBulkMaxTotalIdsError';
  }
}

/** Default max IDs per single Mongo `deleteMany` / `updateMany` `$in` batch (BSON-safe). */
const DEFAULT_CHUNK_SIZE = 5000;
const MAX_CHUNK_SIZE_CAP = 50_000;

/**
 * Env: `CONDUIT_AUTHZ_BULK_CHUNK_SIZE` or `AUTHZ_BULK_ID_CHUNK_SIZE`
 */
export function getAuthzBulkChunkSize(): number {
  const raw =
    process.env.CONDUIT_AUTHZ_BULK_CHUNK_SIZE ?? process.env.AUTHZ_BULK_ID_CHUNK_SIZE;
  const n = raw !== undefined && raw !== '' ? parseInt(raw, 10) : DEFAULT_CHUNK_SIZE;
  if (!Number.isFinite(n) || n < 1) return DEFAULT_CHUNK_SIZE;
  return Math.min(n, MAX_CHUNK_SIZE_CAP);
}

/**
 * Env: `CONDUIT_AUTHZ_BULK_MAX_TOTAL_IDS` — max authorized rows processed per bulk call (0 = unlimited).
 */
export function getAuthzBulkMaxTotalIds(): number {
  const raw = process.env.CONDUIT_AUTHZ_BULK_MAX_TOTAL_IDS;
  if (raw === undefined || raw === '' || raw === '0') return 0;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}
