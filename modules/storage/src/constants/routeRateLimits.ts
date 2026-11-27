import type { RateLimitOptions } from '@conduitplatform/grpc-sdk';

/** Default limit of the client file write routes, used when the config holds no valid value. */
export const STORAGE_WRITE: RateLimitOptions = {
  maxRequests: 60,
  resetInterval: 3600,
};

type RateLimitFields = { maxRequests?: unknown; resetInterval?: unknown };

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/**
 * Returns the limit for the client file write routes from `rateLimits.write` of the
 * storage config. A missing or invalid field falls back to its default.
 */
export function storageWriteRateLimit(config: {
  rateLimits?: { write?: RateLimitFields };
}): RateLimitOptions {
  const write = config?.rateLimits?.write;
  return {
    maxRequests: isPositiveInteger(write?.maxRequests)
      ? write.maxRequests
      : STORAGE_WRITE.maxRequests,
    resetInterval: isPositiveInteger(write?.resetInterval)
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
    if (value !== undefined && !isPositiveInteger(value)) {
      return `rateLimits.write.${field} must be a positive integer`;
    }
  }
  return null;
}
