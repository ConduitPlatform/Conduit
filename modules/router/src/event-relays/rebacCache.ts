type RebacSdk = {
  isAvailable: (module: string) => boolean;
  authorization?: {
    can: (request: {
      subject: string;
      actions: string[];
      resource: string;
    }) => Promise<{ allow: boolean }>;
  } | null;
};

export type RebacDecision = 'allow' | 'deny' | 'unavailable';

const DEFAULT_TTL_MS = 12_000;
const DEFAULT_MAX_ENTRIES = 10_000;

type CacheEntry = {
  decision: 'allow' | 'deny';
  expiresAt: number;
};

export class RelayRebacCache {
  private readonly entries = new Map<string, CacheEntry>();
  constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly maxEntries: number = DEFAULT_MAX_ENTRIES,
  ) {}

  async check(
    grpcSdk: RebacSdk,
    userId: string,
    permission: string,
    resourceType: string,
    resourceId: string,
  ): Promise<RebacDecision> {
    const resource = `${resourceType}:${resourceId}`;
    const key = `${userId}:${permission}:${resource}`;
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
        actions: [permission],
        resource,
      });
      this.set(key, decision.allow ? 'allow' : 'deny', now);
      return decision.allow ? 'allow' : 'deny';
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
  cache: RelayRebacCache,
  grpcSdk: RebacSdk,
  userIds: string[],
  permission: string,
  resourceType: string,
  resourceId: string,
  concurrency = 8,
): Promise<Map<string, RebacDecision>> {
  const results = new Map<string, RebacDecision>();
  let index = 0;
  async function worker(): Promise<void> {
    while (index < userIds.length) {
      const userId = userIds[index++];
      results.set(
        userId,
        await cache.check(grpcSdk, userId, permission, resourceType, resourceId),
      );
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, userIds.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}
