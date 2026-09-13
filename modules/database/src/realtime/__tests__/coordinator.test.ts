import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ObjectId } from 'bson';
import { MongoChangeStreamCoordinator } from '../MongoChangeStreamCoordinator.js';
import { RealtimeSubscriptionTracker } from '../subscriptions.js';
import { roomsForPublicChange } from '../rooms.js';

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

function createCoordinator(overrides?: {
  allow?: boolean;
  authorizationAvailable?: boolean;
  schemas?: {
    name: string;
    collectionName: string;
    authorizationEnabled: boolean;
    cmsReadEnabled?: boolean;
  }[];
}) {
  const stream = new EventEmitter() as EventEmitter & { close: () => Promise<void> };
  stream.close = async () => {
    stream.emit('close');
  };
  const lock = {
    extend: jest.fn(async () => lock),
    release: jest.fn(async () => undefined),
  };
  const routerPush = jest.fn(async () => undefined);
  const adminPush = jest.fn(async () => undefined);
  const publish = jest.fn();
  const watch = jest.fn(() => stream as never);
  const subscriptions = new RealtimeSubscriptionTracker(new MemoryStore());
  const grpcSdk = {
    state: {
      tryAcquireLock: jest.fn(async () => lock),
      releaseLock: jest.fn(async () => undefined),
    },
    bus: { publish },
    router: { socketPush: routerPush },
    admin: { socketPush: adminPush },
    isAvailable: () => overrides?.authorizationAvailable !== false,
    authorization:
      overrides?.authorizationAvailable === false
        ? null
        : {
            can: async () => ({ allow: overrides?.allow !== false }),
          },
  };
  const coordinator = new MongoChangeStreamCoordinator({
    grpcSdk: grpcSdk as never,
    watch,
    hello: async () => ({ setName: 'rs0' }),
    getOptedInSchemas: () =>
      (
        overrides?.schemas ?? [
          { name: 'Order', collectionName: 'orders', authorizationEnabled: false },
        ]
      ).map(schema => ({
        cmsReadEnabled: true,
        ...schema,
      })),
    subscriptions,
    enabled: () => true,
    engine: () => 'MongoDB',
  });
  return {
    coordinator,
    stream,
    watch,
    routerPush,
    adminPush,
    publish,
    subscriptions,
    grpcSdk,
    lock,
  };
}

function insertChange(collection: string, id: string) {
  return {
    operationType: 'insert',
    ns: { coll: collection },
    documentKey: { _id: new ObjectId(id) },
  };
}

function expectWatchFromNow(
  watch: { mock: { calls: unknown[][] } },
  callIndex = 0,
) {
  expect(watch.mock.calls[callIndex]).toHaveLength(1);
  expect(watch.mock.calls[callIndex][0]).not.toHaveProperty('resumeAfter');
}

describe('MongoChangeStreamCoordinator', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits one normalized event to public rooms and ignores other collections', async () => {
    const { coordinator, stream, routerPush, adminPush, publish } = createCoordinator();
    await coordinator.reconcile();
    stream.emit('change', {
      ...insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4c'),
      fullDocument: { secret: 'nope' },
      wallTime: new Date('2026-01-02T00:00:00.000Z'),
    });
    stream.emit('change', insertChange('other', '64b64c4c4c4c4c4c4c4c4c4d'));
    await coordinator.waitForIdle();
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish.mock.calls[0][0]).toBe('database:change:Order');
    const payload = JSON.parse(publish.mock.calls[0][1] as string);
    expect(payload).toMatchObject({
      operation: 'insert',
      schema: 'Order',
      documentId: '64b64c4c4c4c4c4c4c4c4c4c',
    });
    expect(payload).not.toHaveProperty('fullDocument');
    expect(payload).not.toHaveProperty('resumeToken');
    expect(payload).not.toHaveProperty('secret');
    const expectedRooms = roomsForPublicChange('Order', '64b64c4c4c4c4c4c4c4c4c4c');
    expect(routerPush).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'change', rooms: expectedRooms }),
    );
    expect(adminPush).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'change', rooms: expectedRooms }),
    );
    expect(
      JSON.parse((adminPush.mock.calls[0][0] as { data: string }).data),
    ).not.toHaveProperty('resumeToken');
    await coordinator.shutdown();
  });

  it('serializes overlapping handlers', async () => {
    const { coordinator, stream, adminPush } = createCoordinator();
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    let first = true;
    adminPush.mockImplementation(async () => {
      if (first) {
        first = false;
        await gate;
      }
    });
    await coordinator.reconcile();
    stream.emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4c'));
    stream.emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4d'));
    await Promise.resolve();
    await new Promise(resolve => setImmediate(resolve));
    expect(adminPush).toHaveBeenCalledTimes(1);
    release();
    await coordinator.waitForIdle();
    expect(adminPush).toHaveBeenCalledTimes(2);
    await coordinator.shutdown();
  });

  it('watches opted-in collections with $match and $project from now', async () => {
    const { coordinator, watch } = createCoordinator();
    await coordinator.reconcile();
    expect(watch).toHaveBeenCalledTimes(1);
    const pipeline = watch.mock.calls[0][0] as Record<string, unknown>[];
    expectWatchFromNow(watch);
    expect(pipeline[0]).toEqual(
      expect.objectContaining({
        $match: expect.objectContaining({
          $or: expect.arrayContaining([
            expect.objectContaining({
              'ns.coll': { $in: ['orders'] },
            }),
          ]),
        }),
      }),
    );
    expect(pipeline[1]).toEqual({
      $project: {
        fullDocument: 0,
        updateDescription: 0,
        fullDocumentBeforeChange: 0,
      },
    });
    await coordinator.shutdown();
  });

  it('reopens the watch when the opt-in set changes', async () => {
    const schemas = [
      { name: 'Order', collectionName: 'orders', authorizationEnabled: false },
    ];
    const { coordinator, watch } = createCoordinator({ schemas });
    await coordinator.reconcile();
    expect(watch).toHaveBeenCalledTimes(1);
    schemas.push({
      name: 'Item',
      collectionName: 'items',
      authorizationEnabled: false,
    });
    await coordinator.reconcile();
    expect(watch).toHaveBeenCalledTimes(2);
    const pipeline = watch.mock.calls[1][0] as Record<string, unknown>[];
    const match = pipeline[0] as {
      $match: { $or: Array<{ 'ns.coll'?: { $in: string[] } }> };
    };
    expect(match.$match.$or[0]['ns.coll']?.$in).toEqual(
      expect.arrayContaining(['orders', 'items']),
    );
    expectWatchFromNow(watch, 1);
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
    stream.emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4c'));
    await coordinator.waitForIdle();
    expect(routerPush).not.toHaveBeenCalled();
    expect(await subscriptions.listUsers('Order', '64b64c4c4c4c4c4c4c4c4c4c')).toEqual(
      [],
    );
    await coordinator.shutdown();
  });

  it('retries later when the leader lock is held by another instance', async () => {
    jest.useFakeTimers();
    const { coordinator, grpcSdk, lock } = createCoordinator();
    grpcSdk.state.tryAcquireLock.mockResolvedValueOnce(null).mockResolvedValue(lock);
    await coordinator.reconcile();
    expect(coordinator.getState()).toBe('idle');
    await jest.advanceTimersByTimeAsync(1_000);
    expect(coordinator.getState()).toBe('live');
    await coordinator.shutdown();
    jest.useRealTimers();
  });

  it('opens a single watch when reconcile runs concurrently', async () => {
    const { coordinator, watch } = createCoordinator();
    await Promise.all([coordinator.reconcile(), coordinator.reconcile()]);
    expect(watch).toHaveBeenCalledTimes(1);
    await coordinator.shutdown();
  });

  it('stops the stream and retries from now when emit fails', async () => {
    jest.useFakeTimers();
    const streams: Array<EventEmitter & { close: () => Promise<void> }> = [];
    const { coordinator, adminPush, watch } = createCoordinator();
    watch.mockImplementation(() => {
      const next = new EventEmitter() as EventEmitter & { close: () => Promise<void> };
      next.close = async () => {
        next.emit('close');
      };
      streams.push(next);
      return next as never;
    });
    adminPush
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('push failed'))
      .mockResolvedValue(undefined);
    await coordinator.reconcile();
    streams[0].emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4b'));
    await coordinator.waitForIdle();
    streams[0].emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4c'));
    streams[0].emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4d'));
    await coordinator.waitForIdle();
    expect(adminPush).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(watch).toHaveBeenCalledTimes(2);
    expectWatchFromNow(watch, 1);
    streams[1].emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4c'));
    await coordinator.waitForIdle();
    expect(adminPush).toHaveBeenCalledTimes(3);
    await coordinator.shutdown();
    jest.useRealTimers();
  });

  it.each(['drop', 'rename', 'invalidate', 'dropDatabase'] as const)(
    'reopens the watch on %s from now',
    async operationType => {
      jest.useFakeTimers();
      const streams: Array<EventEmitter & { close: () => Promise<void> }> = [];
      const { coordinator, watch } = createCoordinator();
      watch.mockImplementation(() => {
        const next = new EventEmitter() as EventEmitter & { close: () => Promise<void> };
        next.close = async () => {
          next.emit('close');
        };
        streams.push(next);
        return next as never;
      });
      await coordinator.reconcile();
      streams[0].emit('change', {
        operationType,
        ns: { coll: 'orders' },
      });
      await coordinator.waitForIdle();
      await jest.advanceTimersByTimeAsync(1_000);
      expect(watch).toHaveBeenCalledTimes(2);
      expectWatchFromNow(watch, 1);
      await coordinator.shutdown();
      jest.useRealTimers();
    },
  );

  it('does not remove users when authorization is unavailable', async () => {
    const { coordinator, stream, routerPush, subscriptions } = createCoordinator({
      authorizationAvailable: false,
      schemas: [{ name: 'Order', collectionName: 'orders', authorizationEnabled: true }],
    });
    const removeUser = jest.spyOn(subscriptions, 'removeUser');
    await subscriptions.addAuthorizedDocument(
      'sock-1',
      'Order',
      '64b64c4c4c4c4c4c4c4c4c4c',
      'user-1',
    );
    expect(await subscriptions.listUsers('Order', '64b64c4c4c4c4c4c4c4c4c4c')).toEqual([
      'user-1',
    ]);
    await coordinator.reconcile();
    stream.emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4c'));
    await coordinator.waitForIdle();
    expect(routerPush).not.toHaveBeenCalled();
    expect(removeUser).not.toHaveBeenCalled();
    expect(await subscriptions.listUsers('Order', '64b64c4c4c4c4c4c4c4c4c4c')).toEqual([
      'user-1',
    ]);
    await coordinator.shutdown();
  });

  it('does not open a watch when the lock cannot be extended after acquire', async () => {
    const { coordinator, watch, lock } = createCoordinator();
    lock.extend.mockRejectedValueOnce(new Error('extend failed'));
    await coordinator.reconcile();
    expect(watch).not.toHaveBeenCalled();
    expect(coordinator.getState()).toBe('idle');
    await coordinator.shutdown();
  });

  it('ignores draining watch events after lock renew failure', async () => {
    jest.useFakeTimers();
    const { coordinator, stream, lock, adminPush } = createCoordinator();
    lock.extend.mockResolvedValueOnce(lock).mockRejectedValueOnce(new Error('lost lock'));
    await coordinator.reconcile();
    expect(coordinator.getState()).toBe('live');
    await jest.advanceTimersByTimeAsync(5_000);
    expect(coordinator.getState()).toBe('idle');
    stream.emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4c'));
    await coordinator.waitForIdle();
    expect(adminPush).not.toHaveBeenCalled();
    await coordinator.shutdown();
    jest.useRealTimers();
  });

  it('does not emit to clients when CMS read is denied and keeps membership', async () => {
    const can = jest.fn(async () => ({ allow: true }));
    const { coordinator, stream, routerPush, adminPush, subscriptions, grpcSdk } =
      createCoordinator({
        schemas: [
          {
            name: 'Order',
            collectionName: 'orders',
            authorizationEnabled: true,
            cmsReadEnabled: false,
          },
        ],
      });
    grpcSdk.authorization = { can };
    await subscriptions.addAuthorizedDocument(
      'sock-1',
      'Order',
      '64b64c4c4c4c4c4c4c4c4c4c',
      'user-1',
    );
    await coordinator.reconcile();
    stream.emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4c'));
    await coordinator.waitForIdle();
    expect(adminPush).toHaveBeenCalledTimes(1);
    expect(routerPush).not.toHaveBeenCalled();
    expect(can).not.toHaveBeenCalled();
    expect(await subscriptions.listUsers('Order', '64b64c4c4c4c4c4c4c4c4c4c')).toEqual([
      'user-1',
    ]);
    await coordinator.shutdown();
  });
});
