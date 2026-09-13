import { EventEmitter } from 'node:events';
import { describe, expect, it, jest } from '@jest/globals';
import { EJSON, ObjectId } from 'bson';
import { ChangeStreamCoordinator } from '../ChangeStreamCoordinator.js';
import { RealtimeSubscriptionTracker } from '../subscriptions.js';
import { roomsForPublicChange } from '../rooms.js';
import { SQL_LEADER_LOCK } from '../sql/constants.js';

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
  canThrows?: boolean;
  schemas?: {
    name: string;
    collectionName: string;
    authorizationEnabled: boolean;
    documentIdField?: string;
  }[];
  getKeyDelayMs?: number;
  onResumePersisted?: (token: string) => Promise<void>;
  parseResumeToken?: (token: string | null | undefined) => unknown | undefined;
  persistResume?: boolean;
  leaderLock?: string;
  resumeTokenKey?: string;
  adminPush?: () => Promise<void>;
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
  const adminPush = jest.fn(overrides?.adminPush ?? (async () => undefined));
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
    authorization: {
      can: async () => {
        if (overrides?.canThrows) {
          throw new Error('authorization unavailable');
        }
        return { allow: overrides?.allow !== false };
      },
    },
  };
  const coordinator = new ChangeStreamCoordinator({
    grpcSdk: grpcSdk as never,
    watch,
    checkTopology: async () => ({ supported: true }),
    getOptedInSchemas: () =>
      overrides?.schemas ?? [
        { name: 'Order', collectionName: 'orders', authorizationEnabled: false },
      ],
    subscriptions,
    enabled: () => true,
    onResumePersisted: overrides?.onResumePersisted,
    parseResumeToken: overrides?.parseResumeToken,
    persistResume: overrides?.persistResume,
    leaderLock: overrides?.leaderLock,
    resumeTokenKey: overrides?.resumeTokenKey,
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

describe('ChangeStreamCoordinator', () => {
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

  it('persists skipped collection tokens after the opted-in emit', async () => {
    const order: string[] = [];
    const { coordinator, stream, grpcSdk } = createCoordinator({
      onResumePersisted: async () => {
        order.push('trim');
      },
    });
    grpcSdk.state.setKey.mockImplementation(async (key: string, value: string) => {
      order.push(`setKey:${value}`);
    });
    await coordinator.reconcile();
    stream.emit('change', {
      operationType: 'insert',
      ns: { coll: 'orders' },
      documentKey: { _id: new ObjectId('64b64c4c4c4c4c4c4c4c4c4c') },
      _id: { _data: 'token-a' },
      wallTime: new Date('2026-01-02T00:00:00.000Z'),
    });
    stream.emit('change', {
      operationType: 'insert',
      ns: { coll: 'other' },
      documentKey: { _id: new ObjectId('64b64c4c4c4c4c4c4c4c4c4d') },
      _id: { _data: 'token-b' },
    });
    await coordinator.waitForIdle();
    expect(order).toEqual([
      `setKey:${EJSON.stringify({ _data: 'token-a' })}`,
      'trim',
      `setKey:${EJSON.stringify({ _data: 'token-b' })}`,
      'trim',
    ]);
    await coordinator.shutdown();
  });

  it('persists resume and trims only after a successful emit', async () => {
    const order: string[] = [];
    const { coordinator, stream, grpcSdk, publish } = createCoordinator({
      onResumePersisted: async () => {
        order.push('trim');
      },
    });
    publish.mockImplementation(() => {
      order.push('publish');
    });
    grpcSdk.state.setKey.mockImplementation(async () => {
      order.push('setKey');
    });
    await coordinator.reconcile();
    stream.emit('change', {
      operationType: 'update',
      ns: { coll: 'orders' },
      documentKey: { _id: 'order-1' },
      _id: '1842',
      wallTime: new Date('2026-03-01T00:00:00.000Z'),
    });
    await coordinator.waitForIdle();
    expect(order).toEqual(['publish', 'setKey', 'trim']);
    await coordinator.shutdown();
  });

  it('does not persist a later token when emit fails', async () => {
    const { coordinator, stream, grpcSdk, adminPush } = createCoordinator({
      adminPush: async () => {
        throw new Error('socket down');
      },
    });
    await coordinator.reconcile();
    stream.emit('change', {
      operationType: 'insert',
      ns: { coll: 'orders' },
      documentKey: { _id: 'order-1' },
      _id: '10',
      wallTime: new Date('2026-03-01T00:00:00.000Z'),
    });
    await coordinator.waitForIdle();
    expect(grpcSdk.state.setKey).not.toHaveBeenCalled();
    expect(coordinator.getState()).toBe('degraded');
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
    await coordinator.waitForIdle();
    expect(routerPush).not.toHaveBeenCalled();
    expect(await subscriptions.listUsers('Order', '64b64c4c4c4c4c4c4c4c4c')).toEqual([]);
    await coordinator.shutdown();
  });

  it('does not remove users when authorization is unavailable', async () => {
    const { coordinator, stream, routerPush, subscriptions, grpcSdk } = createCoordinator(
      {
        authorizationAvailable: false,
        schemas: [
          { name: 'Order', collectionName: 'orders', authorizationEnabled: true },
        ],
      },
    );
    expect(grpcSdk.isAvailable('authorization')).toBe(false);
    await subscriptions.addAuthorizedDocument('sock-1', 'Order', 'doc-1', 'user-1');
    expect(await subscriptions.listUsers('Order', 'doc-1')).toEqual(['user-1']);
    await coordinator.reconcile();
    stream.emit('change', {
      operationType: 'update',
      ns: { coll: 'orders' },
      documentKey: { _id: 'doc-1' },
      _id: { _data: 'token' },
    });
    await coordinator.waitForIdle();
    expect(routerPush).not.toHaveBeenCalled();
    expect(await subscriptions.listUsers('Order', 'doc-1')).toEqual(['user-1']);
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

  it('clears an unusable resume token and retries', async () => {
    const { coordinator, stream, grpcSdk } = createCoordinator();
    await coordinator.reconcile();
    stream.emit('error', { code: 280, message: 'ChangeStreamHistoryLost' });
    await new Promise(resolve => setImmediate(resolve));
    expect(grpcSdk.state.clearKey).toHaveBeenCalled();
    await coordinator.shutdown();
  });

  it('fans out SQL-shaped WAL events without document fields', async () => {
    const { coordinator, stream, publish } = createCoordinator({ persistResume: false });
    await coordinator.reconcile();
    stream.emit('change', {
      operationType: 'update',
      ns: { coll: 'orders' },
      documentKey: { _id: 'order-1' },
      _id: '0/16B3748:12:1',
      wallTime: new Date('2026-03-01T00:00:00.000Z'),
      fullDocument: { secret: 'nope' },
    });
    await coordinator.waitForIdle();
    expect(publish).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(publish.mock.calls[0][1] as string);
    expect(payload).toMatchObject({
      operation: 'update',
      schema: 'Order',
      documentId: 'order-1',
    });
    expect(payload).not.toHaveProperty('fullDocument');
    expect(JSON.stringify(payload)).not.toContain('nope');
    await coordinator.shutdown();
  });

  it('opens a SQL watch without resume catch-up', async () => {
    const { coordinator, watch, grpcSdk } = createCoordinator({
      persistResume: false,
      leaderLock: SQL_LEADER_LOCK,
    });
    await coordinator.reconcile();
    expect(watch).toHaveBeenCalledWith({ resumeAfter: undefined });
    expect(grpcSdk.state.tryAcquireLock).toHaveBeenCalledWith(
      SQL_LEADER_LOCK,
      expect.any(Number),
    );
    expect(grpcSdk.state.getKey).not.toHaveBeenCalled();
    await coordinator.shutdown();
  });

  it('does not persist resume tokens when persistResume is false', async () => {
    const { coordinator, stream, grpcSdk } = createCoordinator({ persistResume: false });
    await coordinator.reconcile();
    stream.emit('change', {
      operationType: 'insert',
      ns: { coll: 'orders' },
      documentKey: { _id: 'order-1' },
      _id: '0/1:1:1',
      wallTime: new Date('2026-03-01T00:00:00.000Z'),
    });
    await coordinator.waitForIdle();
    expect(grpcSdk.state.setKey).not.toHaveBeenCalled();
    await coordinator.shutdown();
  });
});
