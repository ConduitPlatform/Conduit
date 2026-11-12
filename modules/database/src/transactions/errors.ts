const RETRYABLE_SQL_CODES = new Set<string | number>([
  '40001', // PostgreSQL serialization_failure
  '40P01', // PostgreSQL deadlock_detected
  'ER_LOCK_DEADLOCK',
  'ER_LOCK_WAIT_TIMEOUT',
  1213, // MySQL/MariaDB deadlock
  1205, // MySQL/MariaDB lock wait timeout
  'SQLITE_BUSY',
]);

type DriverError = {
  code?: string | number;
  errno?: number;
  errorLabels?: string[];
  hasErrorLabel?: (label: string) => boolean;
  original?: DriverError;
  parent?: DriverError;
};

/**
 * Whether the database rejected the transaction for a reason that goes away on
 * its own (write conflict, deadlock, serialization failure), so that running the
 * whole transaction again can succeed.
 */
export function isRetryableTransactionError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as DriverError;
  if (typeof err.hasErrorLabel === 'function') {
    if (err.hasErrorLabel('TransientTransactionError')) return true;
  } else if (err.errorLabels?.includes('TransientTransactionError')) {
    return true;
  }
  for (const candidate of [err, err.original, err.parent]) {
    if (!candidate) continue;
    if (candidate.code !== undefined && RETRYABLE_SQL_CODES.has(candidate.code)) {
      return true;
    }
    if (candidate.errno !== undefined && RETRYABLE_SQL_CODES.has(candidate.errno)) {
      return true;
    }
  }
  return false;
}
