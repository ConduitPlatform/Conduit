import type { Cluster, Redis } from 'ioredis';
import type { Indexable } from '../interfaces/index.js';
import type { RedisManager } from './RedisManager.js';
import { inChunks, silenceClientErrors, withTimeout } from './redisHelpers.js';

export const USER_CACHE_PREFIX = 'auth_user_';
export const USER_CACHE_TTL_MS = 5000;
const OP_TIMEOUT_MS = 200;
const CHUNK_SIZE = 100;

type RedisLike = Pick<Redis | Cluster, 'get' | 'set' | 'del'>;

/**
 * Short-lived Redis cache of user documents, stored under `auth_user_<id>` (the prefix is
 * part of the key itself, so the layout is identical on standalone Redis and Cluster).
 *
 * Every operation is bounded by a 200 ms timeout and degrades to a passthrough (miss /
 * no-op) when Redis fails or is unreachable.
 *
 * Staleness: entries live for up to 5 s (`USER_CACHE_TTL_MS`). `invalidate` is not atomic
 * with a concurrent miss: a reader that fetched the user before the invalidation can write
 * the stale document back afterwards, where it stays for up to the TTL.
 */
export class UserCache {
  private readonly client: RedisLike;

  constructor(redisManager: Pick<RedisManager, 'getClient'>) {
    const client = redisManager.getClient();
    silenceClientErrors(client, 'UserCache');
    this.client = client as RedisLike;
  }

  private key(id: string) {
    return USER_CACHE_PREFIX + id;
  }

  async get(id: string): Promise<Indexable | null> {
    try {
      const raw = await withTimeout(() => this.client.get(this.key(id)), OP_TIMEOUT_MS);
      return raw ? (JSON.parse(raw) as Indexable) : null;
    } catch {
      return null;
    }
  }

  async set(id: string, user: Indexable): Promise<void> {
    try {
      await withTimeout(
        () =>
          this.client.set(this.key(id), JSON.stringify(user), 'PX', USER_CACHE_TTL_MS),
        OP_TIMEOUT_MS,
      );
    } catch {
      // cache is best effort
    }
  }

  async invalidate(id: string): Promise<void> {
    try {
      await withTimeout(() => this.client.del(this.key(id)), OP_TIMEOUT_MS);
    } catch {
      // cache is best effort
    }
  }

  async invalidateMany(ids: string[]): Promise<void> {
    // one DEL per key keeps this cluster-safe (keys hash to different slots)
    await inChunks(ids, CHUNK_SIZE, chunk =>
      Promise.all(chunk.map(id => this.invalidate(id))).then(() => undefined),
    );
  }
}
