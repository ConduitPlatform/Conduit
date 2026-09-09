import { describe, expect, it } from '@jest/globals';
import { RealtimeSubscriptionTracker } from '../subscriptions.js';

class MemoryStore {
  private sets = new Map<string, Set<string>>();

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
    keys.forEach(key => this.sets.delete(key));
    return keys.length;
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

  it('removes revoked users from the document set', async () => {
    const tracker = new RealtimeSubscriptionTracker(new MemoryStore());
    await tracker.addAuthorizedDocument('s1', 'Order', 'doc-1', 'user-1');
    await tracker.removeUser('Order', 'doc-1', 'user-1');
    expect(await tracker.listUsers('Order', 'doc-1')).toEqual([]);
  });
});
