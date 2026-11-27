import type { RateLimitOptions } from '@conduitplatform/grpc-sdk';

/** Default limit of the client file write routes, used when the config holds no valid value. */
export const STORAGE_WRITE: RateLimitOptions = {
  maxRequests: 60,
  resetInterval: 3600,
};

/** Upper bounds of the configurable write limit: a million requests, a one day window. */
export const STORAGE_WRITE_MAX: RateLimitOptions = {
  maxRequests: 1_000_000,
  resetInterval: 86_400,
};

type RateLimitFields = { maxRequests?: unknown; resetInterval?: unknown };
type RateLimitField = keyof RateLimitOptions;

function isValidValue(field: RateLimitField, value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= STORAGE_WRITE_MAX[field]
  );
}

/**
 * Returns the limit for the client file write routes from `rateLimits.write` of the
 * storage config. A missing, invalid or out of range field falls back to its default.
 */
export function storageWriteRateLimit(config: {
  rateLimits?: { write?: RateLimitFields };
}): RateLimitOptions {
  const write = config?.rateLimits?.write;
  return {
    maxRequests: isValidValue('maxRequests', write?.maxRequests)
      ? write.maxRequests
      : STORAGE_WRITE.maxRequests,
    resetInterval: isValidValue('resetInterval', write?.resetInterval)
      ? write.resetInterval
      : STORAGE_WRITE.resetInterval,
  };
}

/**
 * Validates `rateLimits` of a config update. Only the fields present are checked, since
 * updates are merged over the current config. Returns an error message, or null.
 */
export function storageRateLimitConfigError(rateLimits: unknown): string | null {
  if (rateLimits === undefined) return null;
  if (
    rateLimits === null ||
    typeof rateLimits !== 'object' ||
    Array.isArray(rateLimits)
  ) {
    return 'rateLimits must be an object';
  }
  const write = (rateLimits as { write?: unknown }).write;
  if (write === undefined) return null;
  if (write === null || typeof write !== 'object' || Array.isArray(write)) {
    return 'rateLimits.write must be an object';
  }
  for (const field of ['maxRequests', 'resetInterval'] as const) {
    const value = (write as RateLimitFields)[field];
    if (value !== undefined && !isValidValue(field, value)) {
      return `rateLimits.write.${field} must be a whole number from 1 to ${STORAGE_WRITE_MAX[field]}`;
    }
  }
  return null;
}
