import type { RedisManager } from './RedisManager.js';

/** Minimal in-memory stand-in for an ioredis client, honouring keyPrefix and PX expiry. */
export class FakeRedisClient {
  readonly store = new Map<string, { value: string; expiresAt: number | null }>();
  now = () => Date.now();
  failing = false;
  /** commands never settle, like ioredis with an offline queue and unreachable redis */
  hanging = false;
  /** commands on matching keys fail */
  failKey: ((key: string) => boolean) | null = null;
  readonly handlers: Record<string, ((e: Error) => void)[]> = {};

  on(event: string, cb: (e: Error) => void) {
    (this.handlers[event] ??= []).push(cb);
    return this;
  }

  constructor(readonly keyPrefix: string = '') {}

  private k(key: string) {
    return this.keyPrefix + key;
  }

  private live(key: string) {
    const entry = this.store.get(this.k(key));
    if (!entry) return undefined;
    if (entry.expiresAt !== null && entry.expiresAt <= this.now()) {
      this.store.delete(this.k(key));
      return undefined;
    }
    return entry;
  }

  private check(): Promise<never> | void {
    if (this.hanging) return new Promise<never>(() => undefined);
    if (this.failing) throw new Error('redis down');
  }

  async get(key: string) {
    await this.check();
    return this.live(key)?.value ?? null;
  }

  async set(key: string, value: string, mode?: string, ttl?: number) {
    await this.check();
    this.store.set(this.k(key), {
      value,
      expiresAt: mode === 'PX' && ttl !== undefined ? this.now() + ttl : null,
    });
    return 'OK';
  }

  async del(key: string) {
    await this.check();
    if (this.failKey?.(key)) throw new Error('boom');
    return this.store.delete(this.k(key)) ? 1 : 0;
  }

  async exists(key: string) {
    await this.check();
    return this.live(key) ? 1 : 0;
  }

  async pexpire(key: string, ttl: number) {
    await this.check();
    const entry = this.live(key);
    if (!entry) return 0;
    entry.expiresAt = this.now() + ttl;
    return 1;
  }
}

export function fakeRedisManager() {
  const clients: FakeRedisClient[] = [];
  const manager = {
    getClient: (options?: { keyPrefix?: string }) => {
      const client = new FakeRedisClient(options?.keyPrefix);
      clients.push(client);
      return client;
    },
  } as unknown as RedisManager;
  return { manager, clients };
}
