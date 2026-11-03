import { ConduitGrpcSdk, GrpcError, Indexable } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

/**
 * User hydration.
 *
 * Client routes guarded by `authMiddleware` / `authMiddleware?` receive `context.user`.
 * In "session" mode the authentication middleware already sets it. In "jwt" mode the
 * router only knows the user id (`context.userId`, from a verified access token), so
 * module-tools fetches the user (through grpcSdk.authentication.getUser, which reads
 * through a 5s Redis cache) before invoking the handler.
 *
 * Opt out per route with `hydrateUser: false` (RouteBuilder.hydrateUser(false)).
 *
 * @deprecated The default flips to off in the next major version. Modules are then
 * expected to call `grpcSdk.authentication.getUser(context.userId)` explicitly.
 */

export interface UserHydrator {
  /** True for `authMiddleware?`: a failed lookup leaves the context untouched. */
  optional: boolean;
  getUser: (userId: string) => Promise<Indexable>;
}

function middlewareList(routeOptions: Indexable): string[] {
  const m = routeOptions?.middlewares;
  if (Array.isArray(m)) return m.filter((x): x is string => typeof x === 'string');
  if (typeof m === 'string') return [m];
  return [];
}

/** Whether the route is guarded by an auth middleware, and if so whether it is the optional form. */
export function getAuthMiddlewareKind(
  routeOptions: Indexable,
): 'required' | 'optional' | undefined {
  const list = middlewareList(routeOptions);
  if (list.includes('authMiddleware')) return 'required';
  if (list.includes('authMiddleware?')) return 'optional';
  return undefined;
}

/**
 * Pure hydration decision: the route has an auth middleware, `hydrateUser` is not false,
 * and the context carries a `userId` but no `user`. Admin routes must not call this.
 */
export function shouldHydrateUser(
  routeOptions: Indexable | undefined,
  context: Indexable | undefined,
): boolean {
  if (!routeOptions || !context) return false;
  if (routeOptions.hydrateUser === false) return false;
  if (!getAuthMiddlewareKind(routeOptions)) return false;
  return typeof context.userId === 'string' && !!context.userId && !context.user;
}

export type UserResolver = (userId: string) => Promise<Indexable>;

/**
 * Builds the per-route hydrator for client routes, or undefined when the route never hydrates.
 * `resolve` is consulted per request (so a resolver registered after route registration still
 * applies) and returns the lookup function to use, if any.
 */
export function createUserHydrator(
  routeOptions: Indexable | undefined,
  resolve: () => UserResolver | undefined,
): UserHydrator | undefined {
  if (!routeOptions) return undefined;
  const kind = getAuthMiddlewareKind(routeOptions);
  if (!kind || routeOptions.hydrateUser === false) return undefined;
  return {
    optional: kind === 'optional',
    getUser: async (userId: string) => {
      const resolver = resolve();
      if (!resolver) throw new GrpcError(status.UNAVAILABLE, 'User lookup unavailable');
      return resolver(userId);
    },
  };
}

/** Maps a failed user lookup to the gRPC code returned to the caller. */
export function mapHydrationErrorCode(error: unknown): number {
  const code = (error as { code?: unknown } | undefined)?.code;
  if (typeof code !== 'number' || code === status.OK) return status.INTERNAL;
  if (code === status.NOT_FOUND) return status.UNAUTHENTICATED;
  return code;
}

/**
 * Sets context.user when needed. For the mandatory form a failed lookup throws a GrpcError:
 * NOT_FOUND becomes UNAUTHENTICATED; PERMISSION_DENIED and every other gRPC code
 * (UNAVAILABLE, DEADLINE_EXCEEDED, INTERNAL, ...) pass through. The optional form
 * swallows the failure and leaves the context untouched. Failures are logged at warn level.
 */
export async function hydrateContextUser(
  routeOptions: Indexable,
  context: Indexable,
  hydrator: UserHydrator,
): Promise<void> {
  if (!shouldHydrateUser(routeOptions, context)) return;
  try {
    context.user = await hydrator.getUser(context.userId);
  } catch (e) {
    ConduitGrpcSdk.Logger.warn(
      `User hydration failed: ${(e as Error)?.message ?? String(e)}`,
    );
    if (!hydrator.optional) {
      const code = mapHydrationErrorCode(e);
      throw new GrpcError(
        code,
        code === status.UNAUTHENTICATED ? 'Unauthorized' : 'User lookup failed',
      );
    }
  }
}
