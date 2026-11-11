import { AccessTokenClaims, Indexable } from '@conduitplatform/grpc-sdk';
import { authErrors, ModuleError } from '@conduitplatform/module-tools';
import type { LocalMiddlewareHandler } from '@conduitplatform/hermes';

export interface JwtVerifierLike {
  readonly strictRevocation: boolean;
  verify(token: string, options?: { clientId?: string; now?: number }): AccessTokenClaims;
}

export interface SessionRegistryLike {
  exists(sid: string): Promise<boolean>;
}

export interface JwtAuthLogger {
  warn(message: string): void;
}

export interface JwtAuthDeps {
  verifier: JwtVerifierLike;
  registry: SessionRegistryLike;
  logger?: JwtAuthLogger;
}

export interface JwtAuthRequest {
  path?: string;
  headers?: Indexable;
  cookies?: Indexable;
  context?: Indexable;
}

const WARN_THROTTLE_MS = 30_000;

/** Wraps a logger so identical-purpose warnings are emitted at most once per 30 s. */
export function throttledLogger(
  logger?: JwtAuthLogger,
  now: () => number = Date.now,
): JwtAuthLogger | undefined {
  if (!logger) return undefined;
  let last = -Infinity;
  return {
    warn: (m: string) => {
      const t = now();
      if (t - last < WARN_THROTTLE_MS) return;
      last = t;
      logger.warn(m);
    },
  };
}

export const TWO_FA_PATHS = [
  '/authentication/twoFa/verify',
  '/authentication/twoFa/authorize',
  '/authentication/twoFa/recover',
];

/** Mirrors AuthUtils.getToken (authentication module) for access tokens. */
export function extractAccessToken(headers: Indexable = {}, cookies: Indexable = {}) {
  const tokenHeader = (headers['Authorization'] || headers['authorization']) as
    string | null | undefined;
  const tokenCookie = cookies['accessToken'] as string | null | undefined;
  if (tokenHeader == null && tokenCookie == null) {
    throw new ModuleError(authErrors.AUTH_TOKEN_MISSING);
  }
  let headerArgs: string[] = [];
  if (tokenHeader) {
    headerArgs = tokenHeader.split(' ');
    if (headerArgs.length !== 2) {
      throw new ModuleError(
        authErrors.AUTH_HEADER_MALFORMED,
        'Authorization header must have exactly two parts',
      );
    }
    if (headerArgs[0] !== 'Bearer') {
      throw new ModuleError(
        authErrors.AUTH_HEADER_MALFORMED,
        "The 'Authorization' header must be prefixed by 'Bearer '",
      );
    }
  }
  return (headerArgs[1] || tokenCookie) as string;
}

export type JwtAuthContextAdditions = {
  userId: string;
  jwtPayload: AccessTokenClaims;
  realm: string | null;
  sessionId: string;
};

/**
 * Local `authMiddleware` used in "jwt" session mode. Error codes match the authentication
 * module's session-mode middleware, but some messages differ (for example
 * 'Token is expired or otherwise not valid' is replaced by the verifier's reason).
 */
export async function jwtAuthenticate(
  deps: JwtAuthDeps,
  request: JwtAuthRequest,
): Promise<JwtAuthContextAdditions> {
  const { verifier, registry, logger } = deps;
  const token = extractAccessToken(request.headers, request.cookies);
  const clientId = request.context?.clientId;
  if (typeof clientId !== 'string' || !clientId) {
    throw new ModuleError(authErrors.CLIENT_ID_MISSING);
  }
  const claims = verifier.verify(token, { clientId });
  if (!claims.authorized && !TWO_FA_PATHS.includes(request.path as string)) {
    throw new ModuleError(authErrors.TWO_FA_REQUIRED);
  }
  if (verifier.strictRevocation) {
    let exists: boolean;
    try {
      exists = await registry.exists(claims.sid);
    } catch (e) {
      const cause = (e as Error)?.message ?? String(e);
      logger?.warn(`Session registry check failed: ${cause}`);
      throw new ModuleError(authErrors.SESSION_REGISTRY_UNAVAILABLE, cause);
    }
    if (!exists) {
      throw new ModuleError(authErrors.SESSION_REVOKED);
    }
  }
  return {
    userId: claims.sub,
    jwtPayload: claims,
    realm: typeof claims.rid === 'string' ? claims.rid : null,
    sessionId: claims.sid,
  };
}

/**
 * Socket.IO skips middlewares on connection recovery; re-validate the session.
 * Contexts without a sessionId (anonymous or public namespaces) are allowed.
 */
export function createSocketRecoveryCheck(
  registry: SessionRegistryLike,
  logger?: JwtAuthLogger,
): (context: Indexable) => Promise<boolean> {
  return async (context: Indexable): Promise<boolean> => {
    if (!context?.sessionId) return true;
    try {
      return (await registry.exists(context.sessionId)) === true;
    } catch (e) {
      logger?.warn(`Session registry check failed: ${(e as Error)?.message ?? e}`);
      return false;
    }
  };
}

/** Keeps the local `authMiddleware` registered exactly while the mode is 'jwt'. */
export function createAuthModeToggle(
  controller: {
    registerLocalMiddleware(name: string, handler: LocalMiddlewareHandler): void;
    unregisterLocalMiddleware(name: string): void;
  },
  handler: LocalMiddlewareHandler,
  logger?: { info(message: string): void },
): (state: { mode: string }) => void {
  let active = false;
  return state => {
    const jwt = state.mode === 'jwt';
    if (jwt === active) return;
    active = jwt;
    if (jwt) controller.registerLocalMiddleware('authMiddleware', handler);
    else controller.unregisterLocalMiddleware('authMiddleware');
    logger?.info(
      `Router authentication: ${jwt ? 'jwt (local verification)' : 'session (authentication module)'}`,
    );
  };
}
