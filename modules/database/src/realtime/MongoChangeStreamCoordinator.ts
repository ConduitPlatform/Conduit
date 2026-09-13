import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { normalizeChangeEvent, type RawChangeEvent } from './normalize.js';
import { authorizedDocumentRoom, roomsForPublicChange } from './rooms.js';
import { topologyFromHello, type TopologyResult } from './topology.js';
import type {
  ChangeStreamLike,
  DatabaseChangeEvent,
  OptedInSchema,
  RealtimeStatusCode,
} from './types.js';
import type { RealtimeSubscriptionTracker } from './subscriptions.js';
import { type AuthorizationSdk } from './authorize.js';
import { checkRebacBatch, RealtimeRebacCache } from './rebacCache.js';
import {
  buildWatchPipeline,
  optedInCollectionsKey,
  WATCH_RESTART_OPERATIONS,
  type WatchPipeline,
} from './watchPipeline.js';

const LEADER_LOCK = 'realtime:change-stream:leader';
const LOCK_TTL_MS = 15_000;
const LOCK_RENEW_MS = 5_000;
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;

type LeaderLock = NonNullable<
  Awaited<ReturnType<NonNullable<ConduitGrpcSdk['state']>['tryAcquireLock']>>
>;

export type WatchFactory = (options: { pipeline: WatchPipeline }) => ChangeStreamLike;

export type CoordinatorOptions = {
  grpcSdk: ConduitGrpcSdk;
  watch: WatchFactory;
  hello: () => Promise<{ setName?: string; msg?: string } | null>;
  getOptedInSchemas: () => OptedInSchema[];
  subscriptions: RealtimeSubscriptionTracker;
  enabled: () => boolean;
  engine: () => string;
};

export class MongoChangeStreamCoordinator {
  private lock: LeaderLock | null = null;
  private stream: ChangeStreamLike | null = null;
  private renewTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;
  private closed = false;
  private streamState: RealtimeStatusCode = 'idle';
  private lastEventAt?: string;
  private lastError?: string;
  private topology: TopologyResult = { supported: false };
  private retryAttempt = 0;
  private watching = false;
  private opening = false;
  private acquiring = false;
  private ignoreClose = false;
  private lockGeneration = 0;
  private changeQueue: Promise<void> = Promise.resolve();
  private watchedCollectionsKey = '';
  private readonly rebacCache = new RealtimeRebacCache();

  constructor(private readonly options: CoordinatorOptions) {}

  getState(): RealtimeStatusCode {
    return this.streamState;
  }

  getLastEventAt(): string | undefined {
    return this.lastEventAt;
  }

  getLastError(): string | undefined {
    return this.lastError;
  }

  getTopology(): TopologyResult {
    return this.topology;
  }

  async waitForIdle(): Promise<void> {
    await this.changeQueue;
  }

  async reconcile(): Promise<void> {
    if (this.closed) return;
    const engine = this.options.engine();
    if (engine !== 'MongoDB' || !this.options.enabled()) {
      await this.stopStream('idle');
      await this.releaseLeader();
      this.streamState = engine !== 'MongoDB' ? 'unsupported' : 'disabled';
      return;
    }
    this.topology = topologyFromHello(await this.options.hello().catch(() => null));
    if (!this.topology.supported) {
      await this.stopStream('idle');
      await this.releaseLeader();
      this.streamState = 'idle';
      this.lastError = this.topology.message;
      if (
        !this.topology.message ||
        this.topology.message.includes('Unable to determine')
      ) {
        this.scheduleRetry();
      }
      return;
    }
    const collections = this.collectionNames();
    if (collections.length === 0) {
      await this.stopStream('idle');
      await this.releaseLeader();
      this.streamState = 'idle';
      return;
    }
    const nextKey = optedInCollectionsKey(collections);
    if (this.watching && nextKey !== this.watchedCollectionsKey) {
      await this.stopStream('starting');
    }
    await this.ensureLeader();
  }

  async shutdown(): Promise<void> {
    this.closed = true;
    this.clearTimers();
    await this.changeQueue;
    await this.stopStream('idle');
    await this.releaseLeader();
    this.rebacCache.clear();
  }

  private collectionNames(): string[] {
    return this.options.getOptedInSchemas().map(schema => schema.collectionName);
  }

  private async ensureLeader(): Promise<void> {
    if (this.lock) {
      if (!this.watching) {
        await this.openStream();
      }
      return;
    }
    if (this.acquiring) return;
    this.acquiring = true;
    try {
      if (this.lock) {
        if (!this.watching) {
          await this.openStream();
        }
        return;
      }
      const acquired = await this.options.grpcSdk.state!.tryAcquireLock(
        LEADER_LOCK,
        LOCK_TTL_MS,
      );
      if (!acquired) {
        this.streamState = 'idle';
        this.scheduleRetry();
        return;
      }
      if (this.lock) {
        try {
          await this.options.grpcSdk.state!.releaseLock(acquired);
        } catch {
          // lock may already have expired
        }
        if (!this.watching) {
          await this.openStream();
        }
        return;
      }
      try {
        this.lock = await acquired.extend(LOCK_TTL_MS);
      } catch {
        try {
          await this.options.grpcSdk.state!.releaseLock(acquired);
        } catch {
          // lock may already have expired
        }
        this.lock = null;
        this.streamState = 'idle';
        this.scheduleRetry();
        return;
      }
      this.bumpLockGeneration();
      this.startRenewal();
      await this.openStream();
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.streamState = 'degraded';
      this.scheduleRetry();
    } finally {
      this.acquiring = false;
    }
  }

  private startRenewal() {
    this.clearRenewTimer();
    this.renewTimer = setInterval(() => {
      void this.renewLock();
    }, LOCK_RENEW_MS);
  }

  private async renewLock() {
    if (!this.lock) return;
    const generation = this.lockGeneration;
    try {
      this.lock = await this.lock.extend(LOCK_TTL_MS);
    } catch {
      if (this.lockGeneration !== generation) return;
      await this.fenceLock('idle');
      this.scheduleRetry();
    }
  }

  private async openStream() {
    if (this.watching || this.closed || this.opening || !this.lock) return;
    this.opening = true;
    this.streamState = 'starting';
    this.ignoreClose = false;
    const generation = this.lockGeneration;
    try {
      const collections = this.collectionNames();
      const pipeline = buildWatchPipeline(collections);
      this.watchedCollectionsKey = optedInCollectionsKey(collections);
      const stream = this.options.watch({ pipeline });
      if (generation !== this.lockGeneration || this.closed) {
        try {
          await stream.close();
        } catch {
          // already closed
        }
        return;
      }
      this.stream = stream;
      this.watching = true;
      this.streamState = 'live';
      this.retryAttempt = 0;
      stream.on('change', (change: unknown) => {
        this.enqueueChange(change as RawChangeEvent, generation);
      });
      stream.on('error', (err: unknown) => {
        if (generation !== this.lockGeneration) return;
        void this.handleStreamError(err);
      });
      stream.on('close', () => {
        if (generation !== this.lockGeneration) return;
        this.watching = false;
        if (!this.closed && !this.ignoreClose && this.lock) {
          this.scheduleRetry();
        }
      });
    } catch (err) {
      this.watching = false;
      await this.handleStreamError(err);
    } finally {
      this.opening = false;
    }
  }

  private enqueueChange(change: RawChangeEvent, generation: number) {
    this.changeQueue = this.changeQueue.then(async () => {
      if (this.closed || !this.watching || generation !== this.lockGeneration) return;
      try {
        await this.handleChange(change, generation);
      } catch (err) {
        if (generation !== this.lockGeneration) return;
        this.lastError = err instanceof Error ? err.message : String(err);
        ConduitGrpcSdk.Logger.error(err as Error);
        this.watching = false;
        await this.stopStream('degraded');
        this.scheduleRetry();
      }
    });
  }

  private async handleChange(change: RawChangeEvent, generation: number) {
    if (generation !== this.lockGeneration) return;
    const schema = this.resolveSchema(change.ns?.coll);
    const event = schema ? normalizeChangeEvent(change, schema.name) : null;
    if (!event || !schema) {
      if (change.operationType && WATCH_RESTART_OPERATIONS.has(change.operationType)) {
        await this.stopStream('starting');
        this.scheduleRetry();
      }
      return;
    }
    this.lastEventAt = event.occurredAt;
    this.lastError = undefined;
    await this.emitChange(schema, event);
  }

  private async emitChange(schema: OptedInSchema, event: DatabaseChangeEvent) {
    const payload = JSON.stringify(event);
    this.options.grpcSdk.bus?.publish(`database:change:${schema.name}`, payload);
    ConduitGrpcSdk.Metrics?.increment('database_realtime_events_total', 1, {
      operation: event.operation,
    });
    await this.pushEvent(schema, event, payload);
  }

  private async pushEvent(
    schema: OptedInSchema,
    event: DatabaseChangeEvent,
    payload: string,
  ) {
    const adminRooms = roomsForPublicChange(schema.name, event.documentId);
    await this.safePush('admin', adminRooms, payload);
    if (!schema.cmsReadEnabled) {
      return;
    }
    if (!schema.authorizationEnabled) {
      await this.safePush('router', adminRooms, payload);
      return;
    }
    const userIds = await this.options.subscriptions.listUsers(
      schema.name,
      event.documentId,
    );
    const decisions = await checkRebacBatch(
      this.rebacCache,
      this.options.grpcSdk as unknown as AuthorizationSdk,
      userIds,
      schema.name,
      event.documentId,
    );
    const allowedRooms: string[] = [];
    for (const userId of userIds) {
      const decision = decisions.get(userId) ?? 'unavailable';
      if (decision === 'allow') {
        allowedRooms.push(authorizedDocumentRoom(schema.name, event.documentId, userId));
        continue;
      }
      if (decision === 'deny') {
        await this.options.subscriptions.removeUser(
          schema.name,
          event.documentId,
          userId,
        );
      }
    }
    if (allowedRooms.length > 0) {
      await this.safePush('router', allowedRooms, payload);
    }
  }

  private async safePush(
    target: 'admin' | 'router',
    rooms: string[],
    data: string,
  ): Promise<void> {
    const client =
      target === 'admin' ? this.options.grpcSdk.admin : this.options.grpcSdk.router;
    if (!client?.socketPush) return;
    await client.socketPush({
      event: 'change',
      data,
      rooms,
      receivers: [],
    });
  }

  private resolveSchema(collectionName?: string): OptedInSchema | undefined {
    if (!collectionName) return undefined;
    return this.options
      .getOptedInSchemas()
      .find(schema => schema.collectionName === collectionName);
  }

  private async handleStreamError(err: unknown) {
    this.watching = false;
    this.lastError = err instanceof Error ? err.message : String(err);
    this.streamState = 'degraded';
    ConduitGrpcSdk.Metrics?.increment('database_realtime_stream_errors_total');
    ConduitGrpcSdk.Logger.error(err as Error);
    await this.stopStream('degraded');
    this.scheduleRetry();
  }

  private scheduleRetry() {
    if (this.closed || this.retryTimer) return;
    const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** this.retryAttempt);
    this.retryAttempt += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.reconcile();
    }, delay);
  }

  private async stopStream(nextState: RealtimeStatusCode) {
    const stream = this.stream;
    this.stream = null;
    this.watching = false;
    this.streamState = nextState;
    this.ignoreClose = true;
    this.watchedCollectionsKey = '';
    if (stream) {
      try {
        await stream.close();
      } catch {
        // already closed
      }
    }
  }

  private async releaseLeader() {
    await this.fenceLock(this.streamState);
  }

  private async fenceLock(nextState: RealtimeStatusCode) {
    this.bumpLockGeneration();
    this.clearRenewTimer();
    const lock = this.lock;
    this.lock = null;
    await this.stopStream(nextState);
    if (!lock) return;
    try {
      await this.options.grpcSdk.state!.releaseLock(lock);
    } catch {
      // lock may already have expired
    }
  }

  private bumpLockGeneration() {
    this.lockGeneration += 1;
  }

  private clearTimers() {
    this.clearRenewTimer();
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private clearRenewTimer() {
    if (this.renewTimer) {
      clearInterval(this.renewTimer);
      this.renewTimer = null;
    }
  }
}
