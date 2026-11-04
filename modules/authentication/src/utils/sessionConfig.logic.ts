import { ensureSigning, isSigningEmpty } from './signingKeys.logic.js';

/*
 * Pure validation of the session-related configuration (access token mode, token
 * lifetimes). No config or grpc access: callers pass the (merged) config.
 */

export const JWT_ACCESS_EXPIRY_MIN_MS = 60_000;
export const JWT_ACCESS_EXPIRY_MAX_MS = 300_000;

export type SessionConfigView = {
  accessTokens?: { mode?: unknown; expiryPeriod?: unknown } | null;
  refreshTokens?: { expiryPeriod?: unknown; maxLifetime?: unknown } | null;
};

export function isJwtMode(config: SessionConfigView | null | undefined): boolean {
  return config?.accessTokens?.mode === 'jwt';
}

/**
 * Returns a human-readable error when the session configuration is invalid, else null.
 *  - accessTokens.mode must be `session` or `jwt` (when set);
 *  - in jwt mode, accessTokens.expiryPeriod must be within 60000..300000 ms;
 *  - when `incoming` (the update as sent) explicitly sets refreshTokens.maxLifetime, it
 *    must be >= the resulting refreshTokens.expiryPeriod. A maxLifetime that merely ended
 *    up below the expiry (an old install, or an expiryPeriod raised on its own) is never
 *    an error: `clampRefreshMaxLifetime` raises it instead.
 * Values that are undefined are skipped (partial updates).
 */
export function sessionModeConfigError(
  config: SessionConfigView | null | undefined,
  incoming?: SessionConfigView | null,
) {
  const mode = config?.accessTokens?.mode;
  if (mode !== undefined && mode !== 'session' && mode !== 'jwt') {
    return `accessTokens.mode must be 'session' or 'jwt'`;
  }
  const accessExpiry = config?.accessTokens?.expiryPeriod;
  if (mode === 'jwt' && accessExpiry !== undefined) {
    const valid =
      typeof accessExpiry === 'number' &&
      accessExpiry >= JWT_ACCESS_EXPIRY_MIN_MS &&
      accessExpiry <= JWT_ACCESS_EXPIRY_MAX_MS;
    if (!valid) {
      return `accessTokens.expiryPeriod must be between ${JWT_ACCESS_EXPIRY_MIN_MS} and ${JWT_ACCESS_EXPIRY_MAX_MS} ms in jwt mode`;
    }
  }
  const explicit = incoming?.refreshTokens?.maxLifetime;
  const refreshExpiry = config?.refreshTokens?.expiryPeriod;
  if (typeof explicit === 'number' && typeof refreshExpiry === 'number') {
    if (explicit < refreshExpiry) {
      return 'refreshTokens.maxLifetime must be greater than or equal to refreshTokens.expiryPeriod';
    }
  }
  return null;
}

/**
 * The effective max lifetime: never below the expiry period. The default (30 days) would
 * otherwise break installs whose refresh expiryPeriod is longer.
 */
export function clampRefreshMaxLifetime(
  refresh: { expiryPeriod?: unknown; maxLifetime?: unknown } | null | undefined,
): { maxLifetime: number | undefined; clamped: boolean } {
  const expiry = refresh?.expiryPeriod;
  const max = refresh?.maxLifetime;
  if (typeof max !== 'number') return { maxLifetime: undefined, clamped: false };
  if (typeof expiry === 'number' && max < expiry) {
    return { maxLifetime: expiry, clamped: true };
  }
  return { maxLifetime: max, clamped: false };
}

/**
 * The view of an incoming partial config update laid over the applied config, so a
 * partial update is validated against the values it would result in.
 */
export function mergeSessionConfigView(
  current: SessionConfigView | null | undefined,
  incoming: SessionConfigView | null | undefined,
): SessionConfigView {
  return {
    accessTokens: { ...current?.accessTokens, ...incoming?.accessTokens },
    refreshTokens: { ...current?.refreshTokens, ...incoming?.refreshTokens },
  };
}

type IncomingConfig = {
  accessTokens?: Record<string, unknown> | null;
  [key: string]: unknown;
};

/**
 * Applies the server-managed session fields to an incoming (PATCH) config update:
 *  - `accessTokens.tokenVersion` on a mode change becomes max(current, incoming ?? 0) + 1,
 *    whatever the update echoes; without a mode change a higher incoming version is
 *    kept (explicit invalidation) and a lower or equal one is dropped;
 *  - `accessTokens.signing` is dropped: only the reconciler, the mode switch and the
 *    rotate route write it.
 * Returns a copy; the input is not mutated.
 */
export function applyServerManagedSessionFields<T extends IncomingConfig>(
  current: { mode?: unknown; tokenVersion?: unknown } | null | undefined,
  incoming: T,
): T {
  if (!incoming?.accessTokens) return incoming;
  const accessTokens: Record<string, unknown> = { ...incoming.accessTokens };
  delete accessTokens.signing;
  const currentVersion =
    typeof current?.tokenVersion === 'number' ? current.tokenVersion : 1;
  const incomingVersion =
    typeof accessTokens.tokenVersion === 'number' ? accessTokens.tokenVersion : undefined;
  const modeChanged =
    accessTokens.mode !== undefined && accessTokens.mode !== current?.mode;
  if (modeChanged) {
    accessTokens.tokenVersion = Math.max(currentVersion, incomingVersion ?? 0) + 1;
  } else if (incomingVersion !== undefined && incomingVersion <= currentVersion) {
    delete accessTokens.tokenVersion;
  }
  return { ...incoming, accessTokens };
}

export type SessionUpdateResult<T> =
  { error: string; incoming?: undefined } | { error: null; incoming: T };

/**
 * The caller-path preparation of a config update (setConfig): validates it against the
 * config it results in, applies the server-managed fields, and mints the signing keypair
 * when the update switches to (or already is in) jwt mode while none exists. Minting
 * happens only here, never for bus-delivered updates.
 */
export function prepareSessionConfigUpdate<T extends IncomingConfig>(
  current:
    (SessionConfigView & { accessTokens?: Record<string, any> }) | null | undefined,
  incoming: T,
): SessionUpdateResult<T> {
  if (!incoming?.accessTokens && !incoming?.refreshTokens) {
    return { error: null, incoming };
  }
  const error = sessionModeConfigError(
    mergeSessionConfigView(current, incoming as SessionConfigView),
    incoming as SessionConfigView,
  );
  if (error) return { error };
  const managed = applyServerManagedSessionFields(current?.accessTokens, incoming);
  const mode = (managed.accessTokens?.mode ?? current?.accessTokens?.mode) as unknown;
  const currentSigning = (current?.accessTokens as Record<string, any> | undefined)
    ?.signing;
  if (mode === 'jwt' && isSigningEmpty(currentSigning)) {
    return {
      error: null,
      incoming: {
        ...managed,
        accessTokens: {
          ...(managed.accessTokens ?? {}),
          signing: ensureSigning(currentSigning),
        },
      },
    };
  }
  return { error: null, incoming: managed };
}
