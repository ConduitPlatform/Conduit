export type SocketEventRateLimit = {
  /** Events a socket may send in a burst. */
  burst: number;
  /** Sustained events per second once the burst is spent. */
  perSecond: number;
};

export const DEFAULT_MAX_HTTP_BUFFER_SIZE = 1e6;

function readNonNegativeNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Per-socket event rate limit from `SOCKET_EVENT_RATE_LIMIT_BURST` and
 * `SOCKET_EVENT_RATE_LIMIT_PER_SECOND`. Returns undefined (no limit) unless both
 * are set to positive values, or when `defaults` is omitted and either is unset.
 * Setting either variable to 0 disables the limit.
 */
export function readSocketEventRateLimit(
  env: NodeJS.ProcessEnv = process.env,
  defaults?: SocketEventRateLimit,
): SocketEventRateLimit | undefined {
  const burst = readNonNegativeNumber(env.SOCKET_EVENT_RATE_LIMIT_BURST) ?? defaults?.burst;
  const perSecond =
    readNonNegativeNumber(env.SOCKET_EVENT_RATE_LIMIT_PER_SECOND) ?? defaults?.perSecond;
  if (!burst || !perSecond) return undefined;
  return { burst, perSecond };
}

/** Max inbound message size from `SOCKET_MAX_HTTP_BUFFER_SIZE` (bytes). */
export function readMaxHttpBufferSize(env: NodeJS.ProcessEnv = process.env): number {
  const value = readNonNegativeNumber(env.SOCKET_MAX_HTTP_BUFFER_SIZE);
  return value && value > 0 ? value : DEFAULT_MAX_HTTP_BUFFER_SIZE;
}

/**
 * Token bucket for one socket. Returns a function that consumes one token and
 * reports whether the event is allowed.
 */
export function createEventBucket(
  limit: SocketEventRateLimit,
  now: () => number = Date.now,
): () => boolean {
  let tokens = limit.burst;
  let last = now();
  return () => {
    const current = now();
    tokens = Math.min(limit.burst, tokens + ((current - last) / 1000) * limit.perSecond);
    last = current;
    if (tokens < 1) return false;
    tokens -= 1;
    return true;
  };
}
