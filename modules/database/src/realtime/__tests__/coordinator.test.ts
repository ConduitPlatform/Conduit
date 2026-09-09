import { EventEmitter } from 'node:events';
import { describe, expect, it, jest } from '@jest/globals';
import { ObjectId } from 'bson';
import { MongoChangeStreamCoordinator } from '../MongoChangeStreamCoordinator.js';
import { RealtimeSubscriptionTracker } from '../subscriptions.js';
import { authorizedDocumentRoom, roomsForPublicChange } from '../rooms.js';

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

function createCoordinator(overrides?: {
  allow?: boolean;
  schemas?: { name: string; collectionName: string; authorizationEnabled: boolean }[];
}) {
  const stream = new EventEmitter() as EventEmitter & { close: () => Promise<void> };
  stream.close = async () => {
    stream.emit('close');
  };
  const state = new Map<string, string>();
  const lock = {
    extend: jest.fn(async () => lock),
    release: jest.fn(async () => undefined),
  };
  const routerPush = jest.fn(async () => undefined);
  const adminPush = jest.fn(async () => undefined);
  const publish = jest.fn();
  const subscriptions = new RealtimeSubscriptionTracker(new MemoryStore());
  const grpcSdk = {
    state: {
      tryAcquireLock: jest.fn(async () => lock),
      releaseLock: jest.fn(async () => undefined),
      getKey: jest.fn(async (key: string) => state.get(key) ?? null),
      setKey: jest.fn(async (key: string, value: string) => {
        state.set(key, value);
      }),
      clearKey: jest.fn(async (key: string) => {
        state.delete(key);
      }),
    },
    bus: { publish },
    router: { socketPush: routerPush },
    admin: { socketPush: adminPush },
    isAvailable: () => true,
    authorization: {
      can: async () => ({ allow: overrides?.allow !== false }),
    },
  };
  const coordinator = new MongoChangeStreamCoordinator({
    grpcSdk: grpcSdk as never,
    watch: () => stream as never,
    hello: async () => ({ setName: 'rs0' }),
    getOptedInSchemas: () =>
      overrides?.schemas ?? [
        { name: 'Order', collectionName: 'orders', authorizationEnabled: false },
      ],
    subscriptions,
    enabled: () => true,
    engine: () => 'MongoDB',
  });
  return {
    coordinator,
    stream,
    routerPush,
    adminPush,
    publish,
    subscriptions,
    grpcSdk,
    state,
    lock,
  };
}

describe('MongoChangeStreamCoordinator', () => {
  it('emits one normalized event to public rooms and ignores other collections', async () => {
    const { coordinator, stream, routerPush, adminPush, publish } = createCoordinator();
    await coordinator.reconcile();
    const resume = { _data: 'token' };
    stream.emit('change', {
      operationType: 'insert',
      ns: { coll: 'orders' },
      documentKey: { _id: new ObjectId('64b64c4c4c4c4c4c4c4c4c4c') },
      fullDocument: { secret: 'nope' },
      _id: resume,
      wallTime: new Date('2026-01-02T00:00:00.000Z'),
    });
    stream.emit('change', {
      operationType: 'insert',
      ns: { coll: 'other' },
      documentKey: { _id: new ObjectId('64b64c4c4c4c4c4c4c4c4c4d') },
      _id: resume,
    });
    await new Promise(resolve => setImmediate(resolve));
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0]).toBe('database:change:Order');
    const payload = JSON.parse(publish.mock.calls[0][1] as string);
    expect(payload).toMatchObject({
      operation: 'insert',
      schema: 'Order',
      documentId: '64b64c4c4c4c4c4c4c4c4c4c',
    });
    expect(payload).not.toHaveProperty('fullDocument');
    expect(payload).not.toHaveProperty('secret');
    const expectedRooms = roomsForPublicChange('Order', '64b64c4c4c4c4c4c4c4c4c4c');
    expect(routerPush).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'change', rooms: expectedRooms }),
    );
    expect(adminPush).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'change', rooms: expectedRooms }),
    );
    await coordinator.shutdown();
  });

  it('re-checks ReBAC before emission and drops revoked users', async () => {
    const { coordinator, stream, routerPush, subscriptions } = createCoordinator({
      allow: false,
      schemas: [{ name: 'Order', collectionName: 'orders', authorizationEnabled: true }],
    });
    await subscriptions.addAuthorizedDocument(
      'sock-1',
      'Order',
      '64b64c4c4c4c4c4c4c4c4c4c',
      'user-1',
    );
    await coordinator.reconcile();
    stream.emit('change', {
      operationType: 'update',
      ns: { coll: 'orders' },
      documentKey: { _id: new ObjectId('64b64c4c4c4c4c4c4c4c4c4c') },
      _id: { _data: 'token' },
    });
    await new Promise(resolve => setImmediate(resolve));
    expect(routerPush).not.toHaveBeenCalled();
    expect(await subscriptions.listUsers('Order', '64b64c4c4c4c4c4c4c4c4c')).toEqual([]);
    expect(authorizedDocumentRoom('Order', '64b64c4c4c4c4c4c4c4c4c', 'user-1')).toContain(
      'user-1',
    );
    await coordinator.shutdown();
  });

  it('clears an unusable resume token and retries', async () => {
    const { coordinator, stream, grpcSdk } = createCoordinator();
    await coordinator.reconcile();
    stream.emit('error', { code: 280, message: 'ChangeStreamHistoryLost' });
    await new Promise(resolve => setImmediate(resolve));
    expect(grpcSdk.state.clearKey).toHaveBeenCalled();
    await coordinator.shutdown();
  });
});
