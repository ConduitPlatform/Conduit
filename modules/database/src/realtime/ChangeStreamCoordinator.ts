import { EJSON } from 'bson';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  normalizeChangeEvent,
  parseResumeToken as parseMongoResumeToken,
  type RawChangeEvent,
} from './normalize.js';
import { authorizedDocumentRoom, roomsForPublicChange } from './rooms.js';
import { isResumeTokenUnusable, type TopologyResult } from './topology.js';
import type {
  ChangeStreamLike,
  DatabaseChangeEvent,
  OptedInSchema,
  RealtimeStatusCode,
} from './types.js';
import type { RealtimeSubscriptionTracker } from './subscriptions.js';
import { documentReadDecision, type AuthorizationSdk } from './authorize.js';

const LEADER_LOCK = 'realtime:change-stream:leader';
const RESUME_TOKEN_KEY = 'realtime:resumeToken';
const LOCK_TTL_MS = 15_000;
const LOCK_RENEW_MS = 5_000;
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;

type LeaderLock = NonNullable<
  Awaited<ReturnType<NonNullable<ConduitGrpcSdk['state']>['tryAcquireLock']>>
>;

export type WatchFactory = (options: { resumeAfter?: unknown }) => ChangeStreamLike;

export type CoordinatorOptions = {
  grpcSdk: ConduitGrpcSdk;
  watch: WatchFactory;
  checkTopology: () => Promise<TopologyResult>;
  getOptedInSchemas: () => OptedInSchema[];
  subscriptions: RealtimeSubscriptionTracker;
  enabled: () => boolean;
  parseResumeToken?: (token: string | null | undefined) => unknown | undefined;
  prepare?: () => Promise<void>;
  onResumePersisted?: (resumeToken: string) => Promise<void>;
  persistResume?: boolean;
  leaderLock?: string;
  resumeTokenKey?: string;
};

export class ChangeStreamCoordinator {
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
  private ignoreClose = false;
  private changeQueue: Promise<void> = Promise.resolve();

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
    if (!this.options.enabled()) {
      await this.safePrepare();
      await this.stopStream('idle');
      await this.releaseLeader();
      this.streamState = 'disabled';
      return;
    }
    this.topology = await this.options.checkTopology().catch(() => ({
      supported: false,
      message: 'Unable to determine database topology',
    }));
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
    try {
      await this.options.prepare?.();
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.streamState = 'degraded';
      ConduitGrpcSdk.Logger.error(err as Error);
      this.scheduleRetry();
      return;
    }
    if (this.options.getOptedInSchemas().length === 0) {
      await this.stopStream('idle');
      await this.releaseLeader();
      this.streamState = 'idle';
      return;
    }
    await this.ensureLeader();
  }

  async shutdown(): Promise<void> {
    this.closed = true;
    this.clearTimers();
    await this.changeQueue;
    await this.stopStream('idle');
    await this.releaseLeader();
  }

  private get leaderLockName(): string {
    return this.options.leaderLock ?? LEADER_LOCK;
  }

  private get resumeTokenName(): string {
    return this.options.resumeTokenKey ?? RESUME_TOKEN_KEY;
  }

  private get persistResume(): boolean {
    return this.options.persistResume !== false;
  }

  private async safePrepare(): Promise<void> {
    try {
      await this.options.prepare?.();
    } catch (err) {
      ConduitGrpcSdk.Logger.error(err as Error);
    }
  }

  private async ensureLeader(): Promise<void> {
    if (this.lock) {
      if (!this.watching) {
        await this.openStream();
      }
      return;
    }
    try {
      const acquired = await this.options.grpcSdk.state!.tryAcquireLock(
        this.leaderLockName,
        LOCK_TTL_MS,
      );
      if (!acquired) {
        this.streamState = 'idle';
        this.scheduleRetry();
        return;
      }
      this.lock = acquired;
      this.startRenewal();
      await this.openStream();
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      this.streamState = 'degraded';
      this.scheduleRetry();
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
    try {
      this.lock = await this.lock.extend(LOCK_TTL_MS);
    } catch {
      this.lock = null;
      await this.stopStream('idle');
      this.scheduleRetry();
    }
  }

  private async openStream() {
    if (this.watching || this.closed || this.opening) return;
    this.opening = true;
    this.streamState = 'starting';
    this.ignoreClose = false;
    try {
      const resumeAfter = this.persistResume
        ? (this.options.parseResumeToken ?? parseMongoResumeToken)(
            await this.options.grpcSdk.state!.getKey(this.resumeTokenName),
          )
        : undefined;
      if (this.watching || this.closed) return;
      const stream = this.options.watch({ resumeAfter });
      this.stream = stream;
      this.watching = true;
      this.streamState = 'live';
      this.retryAttempt = 0;
      stream.on('change', (change: unknown) => {
        this.enqueueChange(change as RawChangeEvent);
      });
      stream.on('error', (err: unknown) => {
        void this.handleStreamError(err);
      });
      stream.on('close', () => {
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

  private enqueueChange(change: RawChangeEvent) {
    this.changeQueue = this.changeQueue.then(async () => {
      if (this.closed || !this.watching) return;
      try {
        await this.handleChange(change);
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : String(err);
        ConduitGrpcSdk.Logger.error(err as Error);
        this.watching = false;
        await this.stopStream('degraded');
        this.scheduleRetry();
      }
    });
  }

  private async handleChange(change: RawChangeEvent) {
    const token = resumeTokenOf(change);
    const schema = this.resolveSchema(change.ns?.coll);
    const event = schema ? normalizeChangeEvent(change, schema.name) : null;
    if (!event || !schema) {
      if (this.persistResume && token) {
        await this.persistResumeToken(token);
      }
      return;
    }
    this.lastEventAt = event.occurredAt;
    this.lastError = undefined;
    await this.emitChange(schema, event);
    if (this.persistResume) {
      await this.persistResumeToken(event.resumeToken);
    }
  }

  private async persistResumeToken(token: string) {
    await this.options.grpcSdk.state!.setKey(this.resumeTokenName, token);
    try {
      await this.options.onResumePersisted?.(token);
    } catch (err) {
      ConduitGrpcSdk.Logger.error(err as Error);
    }
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
    if (!schema.authorizationEnabled) {
      await this.safePush('router', adminRooms, payload);
      return;
    }
    const userIds = await this.options.subscriptions.listUsers(
      schema.name,
      event.documentId,
    );
    const allowedRooms: string[] = [];
    for (const userId of userIds) {
      const decision = await documentReadDecision(
        this.options.grpcSdk as unknown as AuthorizationSdk,
        schema.name,
        event.documentId,
        userId,
      );
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
    if (this.persistResume && isResumeTokenUnusable(err)) {
      await this.options.grpcSdk.state!.clearKey(this.resumeTokenName);
    }
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
    if (stream) {
      try {
        await stream.close();
      } catch {
        // already closed
      }
    }
  }

  private async releaseLeader() {
    this.clearRenewTimer();
    if (!this.lock) return;
    try {
      await this.options.grpcSdk.state!.releaseLock(this.lock);
    } catch {
      // lock may already have expired
    }
    this.lock = null;
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

function resumeTokenOf(change: RawChangeEvent): string | undefined {
  if (change._id === undefined || change._id === null) {
    return undefined;
  }
  return EJSON.stringify(change._id);
}
