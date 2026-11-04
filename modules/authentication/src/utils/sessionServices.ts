import { ConduitGrpcSdk, SessionRegistryData } from '@conduitplatform/grpc-sdk';

/*
 * Process-wide access to the session registry and the user cache (both Redis backed,
 * from the grpc sdk). Everything here is best effort on the write side: a registry or
 * cache failure on a sweep or an invalidation is logged and never fatal. The reads that
 * must fail closed (strict revocation) use the registry directly and handle their own
 * errors.
 *
 * Ports instead of the concrete sdk classes keep the call sites testable with fakes.
 */

export interface SessionRegistryPort {
  register(sid: string, data: SessionRegistryData, ttlMs: number): Promise<void>;
  touch(sid: string, ttlMs: number): Promise<void>;
  exists(sid: string): Promise<boolean>;
  revoke(sid: string): Promise<void>;
  revokeMany(sids: string[]): Promise<void>;
}

export interface UserCachePort {
  get(id: string): Promise<Record<string, any> | null>;
  set(id: string, user: Record<string, any>): Promise<void>;
  invalidate(id: string): Promise<void>;
  invalidateMany(ids: string[]): Promise<void>;
}

/** The slice of a Redis client this module needs (team claims, sudo guard, sid index). */
export interface RedisKeyValuePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'PX', ttlMs: number): Promise<unknown>;
  set(key: string, value: string, mode: 'PX', ttlMs: number, nx: 'NX'): Promise<unknown>;
  del(key: string): Promise<unknown>;
  sadd(key: string, ...members: string[]): Promise<unknown>;
  smembers(key: string): Promise<string[]>;
  pexpire(key: string, ttlMs: number): Promise<unknown>;
}

type Provider<T> = () => T | undefined;

const providers: {
  registry?: Provider<SessionRegistryPort>;
  userCache?: Provider<UserCachePort>;
  redis?: Provider<RedisKeyValuePort>;
} = {};

/** Registers lazy providers (the sdk getters throw until Redis is initialized). */
export function configureSessionServices(next: typeof providers): void {
  Object.assign(providers, next);
}

let sdkRef: ConduitGrpcSdk | undefined;

/** The sdk the services were configured from (for the lazily created singletons). */
export function getConfiguredSdk(): ConduitGrpcSdk {
  if (!sdkRef) throw new Error('Session services are not configured');
  return sdkRef;
}

export function configureSessionServicesFromSdk(grpcSdk: ConduitGrpcSdk): void {
  sdkRef = grpcSdk;
  // RedisManager.getClient() constructs a new connection on every call: create one
  // client lazily and share it
  let client: RedisKeyValuePort | undefined;
  configureSessionServices({
    registry: () => grpcSdk.sessionRegistry,
    userCache: () => grpcSdk.userCache,
    redis: () =>
      (client ??= grpcSdk.redisManager.getClient() as unknown as RedisKeyValuePort),
  });
}

export function resetSessionServices(): void {
  delete providers.registry;
  delete providers.userCache;
  delete providers.redis;
}

function resolve<T>(provider: Provider<T> | undefined): T | undefined {
  try {
    return provider?.();
  } catch {
    return undefined;
  }
}

export function getSessionRegistry(): SessionRegistryPort | undefined {
  return resolve(providers.registry);
}

export function getUserCache(): UserCachePort | undefined {
  return resolve(providers.userCache);
}

export function getRedisKeyValue(): RedisKeyValuePort | undefined {
  return resolve(providers.redis);
}

function warn(message: string, e: unknown) {
  ConduitGrpcSdk.Logger.warn(`${message}: ${(e as Error)?.message ?? e}`);
}

/** Redis set of the uuid session ids (sessions without a refresh row) of a user. */
export const userSessionsKey = (userId: string) => `auth_user_sessions_${userId}`;

/**
 * Indexes a uuid session id under its user, so user-scoped sweeps can reach it (it has no
 * refresh row to be found by). The set lives as long as the newest entry (all uuid
 * sessions live one access token lifetime). Best effort.
 */
export async function indexUserSession(
  userId: string,
  sid: string,
  ttlMs: number,
): Promise<void> {
  const redis = getRedisKeyValue();
  if (!redis) return;
  try {
    const key = userSessionsKey(String(userId));
    await redis.sadd(key, sid);
    await redis.pexpire(key, Math.max(1, Math.ceil(ttlMs)));
  } catch (e) {
    warn('Session index write failed', e);
  }
}

async function takeIndexedSessions(userIds: string[]): Promise<string[]> {
  const redis = getRedisKeyValue();
  if (!redis || userIds.length === 0) return [];
  const sids: string[] = [];
  for (const userId of userIds) {
    try {
      const key = userSessionsKey(userId);
      sids.push(...(await redis.smembers(key)));
      await redis.del(key);
    } catch (e) {
      warn('Session index read failed', e);
    }
  }
  return sids;
}

/**
 * Revokes sessions in the registry. Never throws: failures are logged.
 * `userIds` (user-scoped sweeps only) adds the user's indexed uuid sessions; sweeps
 * scoped by realm or client cannot reach those.
 */
export async function revokeSessions(
  sids: string[],
  context: string,
  options: { userIds?: string[] } = {},
): Promise<void> {
  const indexed = await takeIndexedSessions((options.userIds ?? []).map(String));
  const ids = Array.from(new Set([...sids, ...indexed].map(String).filter(Boolean)));
  if (ids.length === 0) return;
  const registry = getSessionRegistry();
  if (!registry) {
    warn(`Session registry unavailable, ${ids.length} session(s) not revoked`, context);
    return;
  }
  try {
    await registry.revokeMany(ids);
  } catch (e) {
    warn(`Session registry revocation failed (${context})`, e);
  }
}

/** Drops cached user documents. Never throws (the cache itself is best effort). */
export async function invalidateUsers(ids: (string | undefined | null)[]): Promise<void> {
  const unique = Array.from(new Set(ids.filter(Boolean).map(String)));
  if (unique.length === 0) return;
  const cache = getUserCache();
  if (!cache) return;
  try {
    await cache.invalidateMany(unique);
  } catch (e) {
    warn('User cache invalidation failed', e);
  }
}
