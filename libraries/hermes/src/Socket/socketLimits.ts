export type SocketEventRateLimit = {
  /** Events a socket may send in a burst. */
  burst: number;
  /** Sustained events per second once the burst is spent. */
  perSecond: number;
};

export const DEFAULT_MAX_HTTP_BUFFER_SIZE = 1e6;

/** Default per-socket limit: generous for chat and typing indicators, stops floods. */
export const DEFAULT_SOCKET_EVENT_RATE_LIMIT: SocketEventRateLimit = {
  burst: 100,
  perSecond: 30,
};

function readNonNegativeNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Per-socket event rate limit from `SOCKET_EVENT_RATE_LIMIT_BURST` and
 * `SOCKET_EVENT_RATE_LIMIT_PER_SECOND`, falling back to `defaults` for unset ones.
 * Returns undefined (no limit) when either resolves to 0 or is missing.
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

/**
 * Milliseconds until the socket's access token expires, from `jwtPayload.exp`
 * (seconds). Undefined when the context carries no expiry.
 */
export function msUntilTokenExpiry(
  data: { jwtPayload?: { exp?: unknown } } | null | undefined,
  now: number = Date.now(),
): number | undefined {
  const exp = data?.jwtPayload?.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return undefined;
  return exp * 1000 - now;
}

/** Disconnect on token expiry unless `SOCKET_DISCONNECT_ON_TOKEN_EXPIRY=false`. */
export function readDisconnectOnTokenExpiry(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.SOCKET_DISCONNECT_ON_TOKEN_EXPIRY?.trim().toLowerCase() !== 'false';
}

/** setTimeout's maximum delay; longer delays fire immediately. */
export const MAX_TIMER_DELAY_MS = 2_147_483_647;
