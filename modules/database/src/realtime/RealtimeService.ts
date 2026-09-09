import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitNumber,
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter.js';
import { MongooseAdapter } from '../adapters/mongoose-adapter/index.js';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema.js';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema.js';
import { toOptedInSchema } from './authorize.js';
import { MongoChangeStreamCoordinator } from './MongoChangeStreamCoordinator.js';
import { registerDatabaseRealtimeSocket } from './sockets.js';
import { buildRealtimeStatus } from './status.js';
import { RealtimeSubscriptionTracker } from './subscriptions.js';
import type { OptedInSchema, RealtimeStatus } from './types.js';
import type { ChangeStreamLike } from './types.js';

export class RealtimeService {
  private readonly subscriptions: RealtimeSubscriptionTracker;
  private coordinator?: MongoChangeStreamCoordinator;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly adapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>,
  ) {
    this.subscriptions = new RealtimeSubscriptionTracker(
      grpcSdk.redisManager.getClient(),
    );
    this.grpcSdk.bus?.subscribe('database:create:schema', () => {
      void this.reconcile();
    });
    this.grpcSdk.bus?.subscribe('database:delete:schema', () => {
      void this.reconcile();
    });
    if (adapter instanceof MongooseAdapter) {
      this.coordinator = new MongoChangeStreamCoordinator({
        grpcSdk,
        watch: options => this.openWatch(adapter, options.resumeAfter),
        hello: () => this.hello(adapter),
        getOptedInSchemas: () => this.getOptedInSchemas(),
        subscriptions: this.subscriptions,
        enabled: () => this.isGloballyEnabled(),
        engine: () => adapter.getDatabaseType(),
        socketsEnabled: () => this.areAdminSocketsEnabled(),
      });
    }
  }

  registerAdmin(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: '/realtime/status',
        action: ConduitRouteActions.GET,
        description: `Returns live-update capability and runtime status for the database module.`,
      },
      new ConduitRouteReturnDefinition('DatabaseRealtimeStatus', {
        status: ConduitString.Required,
        engine: ConduitString.Required,
        activeSchemaCount: ConduitNumber.Required,
        lastEventAt: ConduitString.Optional,
        message: ConduitString.Optional,
      }),
      async () => this.getStatus(),
    );
    registerDatabaseRealtimeSocket(routingManager, {
      mode: 'admin',
      grpcSdk: this.grpcSdk,
      schemaLookup: this.adapter,
      subscriptions: this.subscriptions,
      isGloballyEnabled: () => this.isGloballyEnabled(),
    });
  }

  registerClient(routingManager: RoutingManager) {
    registerDatabaseRealtimeSocket(routingManager, {
      mode: 'client',
      grpcSdk: this.grpcSdk,
      schemaLookup: this.adapter,
      subscriptions: this.subscriptions,
      isGloballyEnabled: () => this.isGloballyEnabled(),
    });
  }

  async reconcile(): Promise<void> {
    if (!this.coordinator) return;
    await this.coordinator.reconcile();
  }

  async shutdown(): Promise<void> {
    await this.coordinator?.shutdown();
  }

  async getStatus(): Promise<RealtimeStatus> {
    const engine = this.adapter.getDatabaseType();
    const optedIn = this.getOptedInSchemas();
    return buildRealtimeStatus({
      engine,
      enabled: this.isGloballyEnabled(),
      topologySupported: this.coordinator?.getTopology().supported ?? false,
      topologyMessage: this.coordinator?.getTopology().message,
      activeSchemaCount: optedIn.length,
      streamState:
        this.coordinator?.getState() ?? (engine === 'MongoDB' ? 'idle' : 'unsupported'),
      lastEventAt: this.coordinator?.getLastEventAt(),
      lastError: this.coordinator?.getLastError(),
      socketsEnabled: await this.areAdminSocketsEnabled(),
    });
  }

  private isGloballyEnabled(): boolean {
    return ConfigController.getInstance().config?.realtime?.enabled === true;
  }

  private getOptedInSchemas(): OptedInSchema[] {
    const schemas: OptedInSchema[] = [];
    for (const schema of this.adapter.registeredSchemas.values()) {
      const optedIn = toOptedInSchema({
        name: schema.name,
        collectionName: schema.collectionName,
        modelOptions: schema.modelOptions,
      });
      if (optedIn) schemas.push(optedIn);
    }
    return schemas;
  }

  private openWatch(adapter: MongooseAdapter, resumeAfter?: unknown): ChangeStreamLike {
    const db = adapter.mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection is not ready');
    }
    return db.watch(
      [],
      resumeAfter ? { resumeAfter: resumeAfter as never } : {},
    ) as unknown as ChangeStreamLike;
  }

  private async hello(
    adapter: MongooseAdapter,
  ): Promise<{ setName?: string; msg?: string } | null> {
    const db = adapter.mongoose.connection.db;
    if (!db) return null;
    return db.admin().command({ hello: 1 });
  }

  private async areAdminSocketsEnabled(): Promise<boolean> {
    try {
      const adminConfig = await this.grpcSdk.config.get('admin');
      return adminConfig?.transports?.sockets === true;
    } catch {
      return true;
    }
  }
}
