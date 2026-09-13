import { describe, expect, it } from '@jest/globals';
import { canReadDocument } from '../authorize.js';
import { authorizedDocumentRoom } from '../rooms.js';
import { isRecoverableDisconnect, restoreAuthorizedSubscriptions } from '../recovery.js';
import { createSocketHandlers } from '../sockets.js';
import { RealtimeSubscriptionTracker } from '../subscriptions.js';

class MemoryStore {
  private sets = new Map<string, Set<string>>();
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
    keys.forEach(key => this.sets.delete(key));
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
      canRead: canReadDocument,
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
});
