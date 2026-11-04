export type SocketEventRateLimit = {
  /** Events a socket may send in a burst. */
  burst: number;
  /** Sustained events per second once the burst is spent. */
  perSecond: number;
};

/** Runtime socket settings. The Router supplies these from its config. */
export type SocketSettings = {
  /** Max size in bytes of a single inbound message. */
  maxHttpBufferSize: number;
  /** Per-socket event rate limit; undefined means no limit. */
  eventRateLimit?: SocketEventRateLimit;
  /** Disconnect sockets when their access token (`jwtPayload.exp`) expires. */
  disconnectOnTokenExpiry: boolean;
};

/**
 * Library defaults keep Socket.IO's previous behaviour (no rate limit, no expiry
 * disconnect), so socket servers that don't pass settings, such as Admin, are unchanged.
 */
export const DEFAULT_SOCKET_SETTINGS: SocketSettings = {
  maxHttpBufferSize: 1e6,
  eventRateLimit: undefined,
  disconnectOnTokenExpiry: false,
};

function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

/** Fills invalid or missing values from DEFAULT_SOCKET_SETTINGS. */
export function normalizeSocketSettings(
  settings?: Partial<SocketSettings> | null,
): SocketSettings {
  const burst = positive(settings?.eventRateLimit?.burst);
  const perSecond = positive(settings?.eventRateLimit?.perSecond);
  return {
    maxHttpBufferSize:
      positive(settings?.maxHttpBufferSize) ?? DEFAULT_SOCKET_SETTINGS.maxHttpBufferSize,
    eventRateLimit: burst && perSecond ? { burst, perSecond } : undefined,
    disconnectOnTokenExpiry:
      typeof settings?.disconnectOnTokenExpiry === 'boolean'
        ? settings.disconnectOnTokenExpiry
        : DEFAULT_SOCKET_SETTINGS.disconnectOnTokenExpiry,
  };
}

/**
 * Token bucket for one socket. `getLimit` is read on every event so config changes
 * apply to connected sockets; an undefined limit allows everything.
 */
export function createEventBucket(
  getLimit: () => SocketEventRateLimit | undefined,
  now: () => number = Date.now,
): () => boolean {
  let tokens: number | undefined;
  let last = now();
  return () => {
    const limit = getLimit();
    const current = now();
    if (!limit) {
      tokens = undefined;
      last = current;
      return true;
    }
    tokens = Math.min(
      limit.burst,
      (tokens ?? limit.burst) + ((current - last) / 1000) * limit.perSecond,
    );
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

/** setTimeout's maximum delay; longer delays fire immediately. */
export const MAX_TIMER_DELAY_MS = 2_147_483_647;
