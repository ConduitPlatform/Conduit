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
import { canReadDocument, type AuthorizationSdk } from './authorize.js';

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
  socketsEnabled?: () => Promise<boolean>;
  parseResumeToken?: (token: string | null | undefined) => unknown | undefined;
  prepare?: () => Promise<void>;
  onResumePersisted?: (resumeToken: string) => Promise<void>;
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
    await this.stopStream('idle');
    await this.releaseLeader();
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
        LEADER_LOCK,
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
      const parseToken = this.options.parseResumeToken ?? parseMongoResumeToken;
      const resumeAfter = parseToken(
        (await this.options.grpcSdk.state!.getKey(RESUME_TOKEN_KEY)) ?? undefined,
      );
      if (this.watching || this.closed) return;
      const stream = this.options.watch({ resumeAfter: resumeAfter ?? undefined });
      this.stream = stream;
      this.watching = true;
      this.streamState = 'live';
      this.retryAttempt = 0;
      stream.on('change', (change: unknown) => {
        void this.handleChange(change as RawChangeEvent);
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

  private async handleChange(change: RawChangeEvent) {
    const schema = this.resolveSchema(change.ns?.coll);
    if (!schema) return;
    const event = normalizeChangeEvent(change, schema.name);
    if (!event) return;
    this.lastEventAt = event.occurredAt;
    this.lastError = undefined;
    await this.options.grpcSdk.state!.setKey(RESUME_TOKEN_KEY, event.resumeToken);
    try {
      await this.options.onResumePersisted?.(event.resumeToken);
    } catch (err) {
      ConduitGrpcSdk.Logger.error(err as Error);
    }
    this.options.grpcSdk.bus?.publish(
      `database:change:${schema.name}`,
      JSON.stringify(event),
    );
    ConduitGrpcSdk.Metrics?.increment('database_realtime_events_total', 1, {
      operation: event.operation,
    });
    await this.pushEvent(schema, event);
  }

  private async pushEvent(schema: OptedInSchema, event: DatabaseChangeEvent) {
    const payload = JSON.stringify(event);
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
      const allowed = await canReadDocument(
        this.options.grpcSdk as unknown as AuthorizationSdk,
        schema.name,
        event.documentId,
        userId,
      );
      if (!allowed) {
        await this.options.subscriptions.removeUser(
          schema.name,
          event.documentId,
          userId,
        );
        continue;
      }
      allowedRooms.push(authorizedDocumentRoom(schema.name, event.documentId, userId));
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
    try {
      await client.socketPush({
        event: 'change',
        data,
        rooms,
        receivers: [],
      });
    } catch (err) {
      ConduitGrpcSdk.Logger.error(err as Error);
    }
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
    if (isResumeTokenUnusable(err)) {
      await this.options.grpcSdk.state!.clearKey(RESUME_TOKEN_KEY);
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

/** @deprecated Use ChangeStreamCoordinator */
export { ChangeStreamCoordinator as MongoChangeStreamCoordinator };
