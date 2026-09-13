import type { RebacDecision } from './types.js';
import type { AuthorizationSdk } from './authorize.js';

const DEFAULT_TTL_MS = 12_000;
const DEFAULT_MAX_ENTRIES = 10_000;

type CacheEntry = {
  decision: 'allow' | 'deny';
  expiresAt: number;
};

export class RealtimeRebacCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly maxEntries: number = DEFAULT_MAX_ENTRIES,
  ) {}

  async check(
    grpcSdk: AuthorizationSdk,
    userId: string,
    schema: string,
    documentId: string,
  ): Promise<RebacDecision> {
    const resource = `${schema}:${documentId}`;
    const key = `${userId}:read:${resource}`;
    const now = Date.now();
    this.sweepExpired(now);
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.decision;
    }
    if (!grpcSdk.authorization || !grpcSdk.isAvailable('authorization')) {
      return 'unavailable';
    }
    try {
      const decision = await grpcSdk.authorization.can({
        subject: `User:${userId}`,
        actions: ['read'],
        resource,
      });
      const value: 'allow' | 'deny' = decision.allow ? 'allow' : 'deny';
      this.set(key, value, now);
      return value;
    } catch {
      return 'unavailable';
    }
  }

  clear(): void {
    this.entries.clear();
  }

  private set(key: string, decision: 'allow' | 'deny', now: number): void {
    if (this.entries.size >= this.maxEntries && !this.entries.has(key)) {
      const firstKey = this.entries.keys().next().value;
      if (firstKey) {
        this.entries.delete(firstKey);
      }
    }
    this.entries.set(key, { decision, expiresAt: now + this.ttlMs });
  }

  private sweepExpired(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
  }
}

export async function checkRebacBatch(
  cache: RealtimeRebacCache,
  grpcSdk: AuthorizationSdk,
  userIds: string[],
  schema: string,
  documentId: string,
  concurrency = 8,
): Promise<Map<string, RebacDecision>> {
  const results = new Map<string, RebacDecision>();
  let index = 0;
  async function worker(): Promise<void> {
    while (index < userIds.length) {
      const userId = userIds[index++];
      results.set(userId, await cache.check(grpcSdk, userId, schema, documentId));
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, userIds.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}
