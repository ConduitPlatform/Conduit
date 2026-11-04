import type { SessionRegistryData } from '@conduitplatform/grpc-sdk';
import type {
  RedisKeyValuePort,
  SessionRegistryPort,
  UserCachePort,
} from './sessionServices.js';

/** In-memory session registry that records its calls and can be made to fail. */
export function createFakeRegistry() {
  const entries = new Map<string, { data: SessionRegistryData; ttlMs: number }>();
  const calls = {
    register: [] as { sid: string; data: SessionRegistryData; ttlMs: number }[],
    touch: [] as { sid: string; ttlMs: number }[],
    revoke: [] as string[],
    revokeMany: [] as string[][],
  };
  const state = { failing: false };
  const guard = () => {
    if (state.failing) throw new Error('Session registry unavailable');
  };
  const registry: SessionRegistryPort = {
    async register(sid, data, ttlMs) {
      guard();
      calls.register.push({ sid, data, ttlMs });
      entries.set(sid, { data, ttlMs });
    },
    async touch(sid, ttlMs) {
      guard();
      calls.touch.push({ sid, ttlMs });
      const entry = entries.get(sid);
      if (entry) entry.ttlMs = ttlMs;
    },
    async exists(sid) {
      guard();
      return entries.has(sid);
    },
    async revoke(sid) {
      guard();
      calls.revoke.push(sid);
      entries.delete(sid);
    },
    async revokeMany(sids) {
      guard();
      calls.revokeMany.push([...sids]);
      sids.forEach(sid => entries.delete(sid));
    },
  };
  return { registry, entries, calls, state };
}

/** In-memory user cache that records invalidations. */
export function createFakeUserCache() {
  const store = new Map<string, Record<string, any>>();
  const invalidated: string[] = [];
  const cache: UserCachePort = {
    async get(id) {
      return store.get(id) ?? null;
    },
    async set(id, user) {
      store.set(id, user);
    },
    async invalidate(id) {
      invalidated.push(id);
      store.delete(id);
    },
    async invalidateMany(ids) {
      for (const id of ids) await cache.invalidate(id);
    },
  };
  return { cache, store, invalidated };
}

/** In-memory Redis stand-in (get, set PX [NX], del, sets) that records the ttl of each key. */
export function createFakeRedis() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const ttls = new Map<string, number>();
  const redis: RedisKeyValuePort = {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string, _mode: 'PX', ttlMs: number, nx?: 'NX') {
      if (nx === 'NX' && store.has(key)) return null;
      store.set(key, value);
      ttls.set(key, ttlMs);
      return 'OK';
    },
    async del(key) {
      ttls.delete(key);
      const had = store.delete(key) || sets.delete(key);
      return had ? 1 : 0;
    },
    async sadd(key, ...members) {
      const set = sets.get(key) ?? new Set<string>();
      members.forEach(m => set.add(m));
      sets.set(key, set);
      return members.length;
    },
    async smembers(key) {
      return [...(sets.get(key) ?? [])];
    },
    async pexpire(key, ttlMs) {
      ttls.set(key, ttlMs);
      return 1;
    },
  };
  return { redis, store, sets, ttls };
}
