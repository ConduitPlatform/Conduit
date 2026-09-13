import { describe, expect, it } from '@jest/globals';
import { authorizedDocumentRoom } from '../rooms.js';
import { isRecoverableDisconnect, restoreAuthorizedSubscriptions } from '../recovery.js';
import { createSocketHandlers } from '../sockets.js';
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
  }
  async srem(key: string, ...members: string[]) {
    members.forEach(member => this.sets.get(key)?.delete(member));
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
  }
  async expire(key: string, seconds: number) {
    this.ttls.set(key, seconds);
  }
  async persist(key: string) {
    this.ttls.delete(key);
  }
}

describe('database socket recovery', () => {
  it('does not treat transport close as a wipe', () => {
    expect(isRecoverableDisconnect('transport close')).toBe(true);
    expect(isRecoverableDisconnect('client namespace disconnect')).toBe(false);
  });

  it('restores authorized Redis membership after a recoverable disconnect', async () => {
    const tracker = new RealtimeSubscriptionTracker(new MemoryStore());
    const room = authorizedDocumentRoom('Order', 'doc-1', 'user-1');
    await tracker.addAuthorizedDocument('sock-1', 'Order', 'doc-1', 'user-1');
    await tracker.disconnect('sock-1');
    expect(await tracker.listUsers('Order', 'doc-1')).toEqual([]);

    await restoreAuthorizedSubscriptions({
      socketId: 'sock-1',
      rooms: [room],
      contextSubs: [],
      subscriptions: tracker,
      grpcSdk: {
        isAvailable: () => true,
        authorization: { can: async () => ({ allow: true }) },
      },
    });
    expect(await tracker.listUsers('Order', 'doc-1')).toEqual(['user-1']);
  });

  it('keeps recovered /database/ sockets in the authorized list', async () => {
    const tracker = new RealtimeSubscriptionTracker(new MemoryStore());
    await tracker.addAuthorizedDocument('sock-1', 'Order', 'doc-1', 'user-1');
    const handlers = createSocketHandlers({
      mode: 'client',
      grpcSdk: {
        isAvailable: () => true,
        authorization: { can: async () => ({ allow: true }) },
      } as never,
      schemaLookup: { getSchema: () => undefined },
      subscriptions: tracker,
      isGloballyEnabled: () => true,
    });
    await handlers.disconnect({
      request: { socketId: 'sock-1', params: ['transport close'] },
    } as never);
    expect(await tracker.listUsers('Order', 'doc-1')).toEqual(['user-1']);
    await handlers.recovered({
      request: {
        socketId: 'sock-1',
        params: [authorizedDocumentRoom('Order', 'doc-1', 'user-1')],
        context: {},
      },
    } as never);
    expect(await tracker.listUsers('Order', 'doc-1')).toEqual(['user-1']);
  });

  it('keeps membership when recovered authorization is unavailable', async () => {
    const tracker = new RealtimeSubscriptionTracker(new MemoryStore());
    const room = authorizedDocumentRoom('Order', 'doc-1', 'user-1');
    await tracker.addAuthorizedDocument('sock-1', 'Order', 'doc-1', 'user-1');
    const { leaveRooms } = await restoreAuthorizedSubscriptions({
      socketId: 'sock-1',
      rooms: [room],
      contextSubs: [],
      subscriptions: tracker,
      grpcSdk: {
        isAvailable: () => false,
      },
    });
    expect(leaveRooms).toEqual([]);
    expect(await tracker.listUsers('Order', 'doc-1')).toEqual(['user-1']);
  });

  it('expires Redis membership when a recoverable disconnect never recovers', async () => {
    const store = new MemoryStore();
    const tracker = new RealtimeSubscriptionTracker(store);
    const handlers = createSocketHandlers({
      mode: 'client',
      grpcSdk: {
        isAvailable: () => true,
        authorization: { can: async () => ({ allow: true }) },
      } as never,
      schemaLookup: { getSchema: () => undefined },
      subscriptions: tracker,
      isGloballyEnabled: () => true,
    });
    await tracker.addAuthorizedDocument('sock-1', 'Order', 'doc-1', 'user-1');
    expect(store.ttls.size).toBe(0);
    await handlers.disconnect({
      request: { socketId: 'sock-1', params: ['transport close'] },
    } as never);
    expect(await tracker.listUsers('Order', 'doc-1')).toEqual(['user-1']);
    expect(store.ttls.get('realtime:socket:sock-1')).toBe(RECOVERY_REDIS_TTL_SECONDS);
    expect(store.ttls.get('realtime:doc:Order:doc-1')).toBe(RECOVERY_REDIS_TTL_SECONDS);
    expect(store.ttls.get('realtime:userdoc:Order:doc-1:user-1')).toBe(
      RECOVERY_REDIS_TTL_SECONDS,
    );
  });
});
