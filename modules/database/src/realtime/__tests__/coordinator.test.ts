import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { EJSON, ObjectId } from 'bson';
import { MongoChangeStreamCoordinator } from '../MongoChangeStreamCoordinator.js';
import { RealtimeSubscriptionTracker } from '../subscriptions.js';
import { roomsForPublicChange } from '../rooms.js';

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

function createCoordinator(overrides?: {
  allow?: boolean;
  authorizationAvailable?: boolean;
  schemas?: { name: string; collectionName: string; authorizationEnabled: boolean }[];
  getKeyDelayMs?: number;
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
  const watch = jest.fn(() => stream as never);
  const subscriptions = new RealtimeSubscriptionTracker(new MemoryStore());
  const grpcSdk = {
    state: {
      tryAcquireLock: jest.fn(async () => lock),
      releaseLock: jest.fn(async () => undefined),
      getKey: jest.fn(async (key: string) => {
        if (overrides?.getKeyDelayMs) {
          await new Promise(resolve => setTimeout(resolve, overrides.getKeyDelayMs));
        }
        return state.get(key) ?? null;
      }),
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
    watch,
    routerPush,
    adminPush,
    publish,
    subscriptions,
    grpcSdk,
    state,
    lock,
  };
}

function insertChange(collection: string, id: string, token: unknown) {
  return {
    operationType: 'insert',
    ns: { coll: collection },
    documentKey: { _id: new ObjectId(id) },
    _id: token,
  };
}

describe('MongoChangeStreamCoordinator', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits one normalized event to public rooms and ignores other collections', async () => {
    const { coordinator, stream, routerPush, adminPush, publish, state } =
      createCoordinator();
    await coordinator.reconcile();
    const resume = { _data: 'token' };
    stream.emit('change', {
      ...insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4c', resume),
      fullDocument: { secret: 'nope' },
      wallTime: new Date('2026-01-02T00:00:00.000Z'),
    });
    stream.emit('change', insertChange('other', '64b64c4c4c4c4c4c4c4c4c4d', resume));
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
    expect(state.get('realtime:resumeToken')).toBe(EJSON.stringify(resume));
    await coordinator.shutdown();
  });

  it('advances the resume token for filtered events', async () => {
    const { coordinator, stream, publish, state } = createCoordinator();
    await coordinator.reconcile();
    const skip = { _data: 'skip-token' };
    stream.emit('change', insertChange('other', '64b64c4c4c4c4c4c4c4c4c4d', skip));
    await coordinator.waitForIdle();
    expect(publish).not.toHaveBeenCalled();
    expect(state.get('realtime:resumeToken')).toBe(EJSON.stringify(skip));
    await coordinator.shutdown();
  });

  it('serializes overlapping handlers and persists after emit', async () => {
    const { coordinator, stream, state, adminPush } = createCoordinator();
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
    const tokenA = { _data: 'token-a' };
    const tokenB = { _data: 'token-b' };
    stream.emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4c', tokenA));
    stream.emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4d', tokenB));
    await Promise.resolve();
    await new Promise(resolve => setImmediate(resolve));
    expect(state.get('realtime:resumeToken')).toBeUndefined();
    expect(adminPush).toHaveBeenCalledTimes(1);
    release();
    await coordinator.waitForIdle();
    expect(adminPush).toHaveBeenCalledTimes(2);
    expect(state.get('realtime:resumeToken')).toBe(EJSON.stringify(tokenB));
    await coordinator.shutdown();
  });

  it('watches opted-in collections with $match and $project', async () => {
    const { coordinator, watch } = createCoordinator();
    await coordinator.reconcile();
    expect(watch).toHaveBeenCalledTimes(1);
    const pipeline = (watch.mock.calls[0][0] as { pipeline: Record<string, unknown>[] })
      .pipeline;
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
    const pipeline = (watch.mock.calls[1][0] as { pipeline: Record<string, unknown>[] })
      .pipeline;
    const match = pipeline[0] as {
      $match: { $or: Array<{ 'ns.coll'?: { $in: string[] } }> };
    };
    expect(match.$match.$or[0]['ns.coll']?.$in).toEqual(
      expect.arrayContaining(['orders', 'items']),
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
    stream.emit(
      'change',
      insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4c', { _data: 'token' }),
    );
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
    const { coordinator, watch } = createCoordinator({ getKeyDelayMs: 40 });
    await Promise.all([coordinator.reconcile(), coordinator.reconcile()]);
    expect(watch).toHaveBeenCalledTimes(1);
    await coordinator.shutdown();
  });

  it('clears an unusable resume token on 280 and retries', async () => {
    const { coordinator, stream, grpcSdk } = createCoordinator();
    await coordinator.reconcile();
    stream.emit('error', { code: 280, message: 'ChangeStreamHistoryLost' });
    await new Promise(resolve => setImmediate(resolve));
    expect(grpcSdk.state.clearKey).toHaveBeenCalled();
    await coordinator.shutdown();
  });

  it('keeps the resume token on CursorKilled 237', async () => {
    const { coordinator, stream, grpcSdk, state } = createCoordinator();
    await coordinator.reconcile();
    const token = { _data: 'keep-me' };
    stream.emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4c', token));
    await coordinator.waitForIdle();
    expect(state.get('realtime:resumeToken')).toBe(EJSON.stringify(token));
    stream.emit('error', { code: 237, message: 'CursorKilled' });
    await new Promise(resolve => setImmediate(resolve));
    expect(grpcSdk.state.clearKey).not.toHaveBeenCalled();
    expect(state.get('realtime:resumeToken')).toBe(EJSON.stringify(token));
    await coordinator.shutdown();
  });

  it('does not persist a later token when emit fails and reopens from the last good token', async () => {
    jest.useFakeTimers();
    const streams: Array<EventEmitter & { close: () => Promise<void> }> = [];
    const { coordinator, adminPush, state, watch } = createCoordinator();
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
    const tokenGood = { _data: 'token-good' };
    const tokenA = { _data: 'token-a' };
    const tokenB = { _data: 'token-b' };
    streams[0].emit(
      'change',
      insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4b', tokenGood),
    );
    await coordinator.waitForIdle();
    expect(state.get('realtime:resumeToken')).toBe(EJSON.stringify(tokenGood));
    streams[0].emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4c', tokenA));
    streams[0].emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4d', tokenB));
    await coordinator.waitForIdle();
    expect(state.get('realtime:resumeToken')).toBe(EJSON.stringify(tokenGood));
    expect(adminPush).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1_000);
    expect(watch).toHaveBeenCalledTimes(2);
    expect((watch.mock.calls[1][0] as { resumeAfter?: unknown }).resumeAfter).toEqual(
      tokenGood,
    );
    streams[1].emit('change', insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4c', tokenA));
    await coordinator.waitForIdle();
    expect(state.get('realtime:resumeToken')).toBe(EJSON.stringify(tokenA));
    expect(adminPush).toHaveBeenCalledTimes(3);
    await coordinator.shutdown();
    jest.useRealTimers();
  });

  it.each(['drop', 'rename', 'invalidate'] as const)(
    'reopens the watch on %s',
    async operationType => {
      jest.useFakeTimers();
      const streams: Array<EventEmitter & { close: () => Promise<void> }> = [];
      const { coordinator, watch, state } = createCoordinator();
      watch.mockImplementation(() => {
        const next = new EventEmitter() as EventEmitter & { close: () => Promise<void> };
        next.close = async () => {
          next.emit('close');
        };
        streams.push(next);
        return next as never;
      });
      await coordinator.reconcile();
      const token = { _data: `${operationType}-token` };
      streams[0].emit('change', {
        operationType,
        ns: { coll: 'orders' },
        _id: token,
      });
      await coordinator.waitForIdle();
      expect(state.get('realtime:resumeToken')).toBe(EJSON.stringify(token));
      await jest.advanceTimersByTimeAsync(1_000);
      expect(watch).toHaveBeenCalledTimes(2);
      expect((watch.mock.calls[1][0] as { resumeAfter?: unknown }).resumeAfter).toEqual(
        token,
      );
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
    stream.emit(
      'change',
      insertChange('orders', '64b64c4c4c4c4c4c4c4c4c4c', { _data: 'token' }),
    );
    await coordinator.waitForIdle();
    expect(routerPush).not.toHaveBeenCalled();
    expect(removeUser).not.toHaveBeenCalled();
    expect(await subscriptions.listUsers('Order', '64b64c4c4c4c4c4c4c4c4c4c')).toEqual([
      'user-1',
    ]);
    await coordinator.shutdown();
  });
});
