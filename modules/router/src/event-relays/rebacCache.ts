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

const DEFAULT_TTL_MS = 12_000;

type CacheEntry = {
  allow: boolean;
  expiresAt: number;
};

export class RelayRebacCache {
  private readonly entries = new Map<string, CacheEntry>();
  constructor(private readonly ttlMs: number = DEFAULT_TTL_MS) {}

  async can(
    grpcSdk: RebacSdk,
    userId: string,
    permission: string,
    resourceType: string,
    resourceId: string,
  ): Promise<boolean> {
    const resource = `${resourceType}:${resourceId}`;
    const key = `${userId}:${permission}:${resource}`;
    const now = Date.now();
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.allow;
    }
    if (!grpcSdk.authorization || !grpcSdk.isAvailable('authorization')) {
      return false;
    }
    try {
      const decision = await grpcSdk.authorization.can({
        subject: `User:${userId}`,
        actions: [permission],
        resource,
      });
      this.entries.set(key, {
        allow: decision.allow,
        expiresAt: now + this.ttlMs,
      });
      return decision.allow;
    } catch {
      return false;
    }
  }

  clear(): void {
    this.entries.clear();
  }
}
