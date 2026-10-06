import { describe, expect, it } from '@jest/globals';
import {
  RealtimeSubscriptionTracker,
  RECOVERY_REDIS_TTL_SECONDS,
} from '../subscriptions.js';

class MemoryStore {
  private sets = new Map<string, Set<string>>();
  readonly ttls = new Map<string, number>();

  async sadd(key: string, ...members: string[]) {
    const set = this.sets.get(key) ?? new Set<string>();
    members.forEach(member => set.add(member));
    this.sets.set(key, set);
    return members.length;
  }

  async srem(key: string, ...members: string[]) {
    const set = this.sets.get(key);
    if (!set) return 0;
    members.forEach(member => set.delete(member));
    return members.length;
  }

  async smembers(key: string) {
    return [...(this.sets.get(key) ?? new Set())];
  }

  async scard(key: string) {
    return this.sets.get(key)?.size ?? 0;
  }

  async del(...keys: string[]) {
    keys.forEach(key => {
      this.sets.delete(key);
      this.ttls.delete(key);
    });
    return keys.length;
  }

  async expire(key: string, seconds: number) {
    this.ttls.set(key, seconds);
  }

  async persist(key: string) {
    this.ttls.delete(key);
  }
}

describe('RealtimeSubscriptionTracker', () => {
  it('tracks users per document and cleans up on disconnect', async () => {
    const tracker = new RealtimeSubscriptionTracker(new MemoryStore());
    await tracker.addAuthorizedDocument('s1', 'Order', 'doc-1', 'user-1');
    await tracker.addAuthorizedDocument('s2', 'Order', 'doc-1', 'user-1');
    expect(await tracker.listUsers('Order', 'doc-1')).toEqual(['user-1']);

    await tracker.disconnect('s1');
    expect(await tracker.listUsers('Order', 'doc-1')).toEqual(['user-1']);

    await tracker.disconnect('s2');
    expect(await tracker.listUsers('Order', 'doc-1')).toEqual([]);
  });

  it('does not expire shared document keys while another socket is still live', async () => {
    const store = new MemoryStore();
    const tracker = new RealtimeSubscriptionTracker(store);
    await tracker.addAuthorizedDocument('s1', 'Order', 'doc-1', 'user-1');
    await tracker.addAuthorizedDocument('s2', 'Order', 'doc-1', 'user-1');
    await tracker.armRecoverableTtl('s1');
    expect(store.ttls.get('realtime:socket:s1')).toBe(RECOVERY_REDIS_TTL_SECONDS);
    expect(store.ttls.has('realtime:doc:Order:doc-1')).toBe(false);
    expect(store.ttls.has('realtime:userdoc:Order:doc-1:user-1')).toBe(false);
  });

  it('removes revoked users from the document set', async () => {
    const tracker = new RealtimeSubscriptionTracker(new MemoryStore());
    await tracker.addAuthorizedDocument('s1', 'Order', 'doc-1', 'user-1');
    await tracker.removeUser('Order', 'doc-1', 'user-1');
    expect(await tracker.listUsers('Order', 'doc-1')).toEqual([]);
  });

  it('arms Redis TTL on recoverable disconnect keys and persists on restore', async () => {
    const store = new MemoryStore();
    const tracker = new RealtimeSubscriptionTracker(store);
    await tracker.addAuthorizedDocument('s1', 'Order', 'doc-1', 'user-1');
    expect(store.ttls.size).toBe(0);
    await tracker.armRecoverableTtl('s1');
    expect(store.ttls.get('realtime:socket:s1')).toBe(RECOVERY_REDIS_TTL_SECONDS);
    expect(store.ttls.get('realtime:doc:Order:doc-1')).toBe(RECOVERY_REDIS_TTL_SECONDS);
    expect(store.ttls.get('realtime:userdoc:Order:doc-1:user-1')).toBe(
      RECOVERY_REDIS_TTL_SECONDS,
    );
    await tracker.addAuthorizedDocument('s1', 'Order', 'doc-1', 'user-1');
    expect(store.ttls.size).toBe(0);
  });
});
