import type { Cluster, Redis } from 'ioredis';
import type { RedisManager } from './RedisManager.js';
import { inChunks, silenceClientErrors, withTimeout } from './redisHelpers.js';

export const SESSION_REGISTRY_PREFIX = 'auth_session_';
const OP_TIMEOUT_MS = 500;
const CHUNK_SIZE = 100;

export interface SessionRegistryData {
  user: string;
  clientId: string;
  realm?: string | null;
}

type RedisLike = Pick<Redis | Cluster, 'set' | 'del' | 'exists' | 'pexpire'>;

/**
 * Redis registry of live sessions, one `auth_session_<sid>` key per session (the prefix is
 * part of the key itself, so the layout is identical on standalone Redis and Cluster).
 *
 * Every operation is bounded by a 500 ms timeout and rejects with
 * `Error('Session registry unavailable')` when Redis fails or is unreachable, so callers
 * can fail closed.
 */
export class SessionRegistry {
  private readonly client: RedisLike;

  constructor(redisManager: Pick<RedisManager, 'getClient'>) {
    const client = redisManager.getClient();
    silenceClientErrors(client, 'SessionRegistry');
    this.client = client as RedisLike;
  }

  private key(sid: string) {
    return SESSION_REGISTRY_PREFIX + sid;
  }

  private async run<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await withTimeout(op, OP_TIMEOUT_MS);
    } catch {
      throw new Error('Session registry unavailable');
    }
  }

  private static ttl(ttlMs: number) {
    return Math.max(1, Math.ceil(ttlMs));
  }

  async register(sid: string, data: SessionRegistryData, ttlMs: number): Promise<void> {
    const value = JSON.stringify({
      user: data.user,
      clientId: data.clientId,
      realm: data.realm ?? null,
    });
    await this.run(() =>
      this.client.set(this.key(sid), value, 'PX', SessionRegistry.ttl(ttlMs)),
    );
  }

  /** Extends the session's lifetime. Does nothing for an unknown session. */
  async touch(sid: string, ttlMs: number): Promise<void> {
    await this.run(() => this.client.pexpire(this.key(sid), SessionRegistry.ttl(ttlMs)));
  }

  async exists(sid: string): Promise<boolean> {
    return (await this.run(() => this.client.exists(this.key(sid)))) === 1;
  }

  async revoke(sid: string): Promise<void> {
    await this.run(() => this.client.del(this.key(sid)));
  }

  /** Attempts every sid; throws an Error listing the sids that could not be revoked. */
  async revokeMany(sids: string[]): Promise<void> {
    const failed: string[] = [];
    // one DEL per key keeps this cluster-safe (keys hash to different slots)
    await inChunks(sids, CHUNK_SIZE, async chunk => {
      const results = await Promise.allSettled(chunk.map(sid => this.revoke(sid)));
      results.forEach((r, i) => {
        if (r.status === 'rejected') failed.push(chunk[i]);
      });
    });
    if (failed.length > 0) {
      throw new Error(`Failed to revoke sessions: ${failed.join(', ')}`);
    }
  }
}
