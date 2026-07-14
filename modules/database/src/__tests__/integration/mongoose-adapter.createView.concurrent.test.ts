const integrationEnabled =
  !!process.env.DB_CONN_URI && !!process.env.REDIS_HOST && !!process.env.REDIS_PORT;

const describeIntegration = integrationEnabled ? describe : describe.skip;

describeIntegration('MongooseAdapter createView concurrent multi-instance', () => {
  let connectionUri: string;
  let adapterA: import('../../adapters/mongoose-adapter/index.js').MongooseAdapter;
  let adapterB: import('../../adapters/mongoose-adapter/index.js').MongooseAdapter;
  let grpcSdkA: import('@conduitplatform/grpc-sdk').ConduitGrpcSdk | undefined;
  let grpcSdkB: import('@conduitplatform/grpc-sdk').ConduitGrpcSdk | undefined;
  let setupError: unknown;
  let modelName: string;
  let servicesAvailable = integrationEnabled;
  const viewName = `concurrent_test_view_${Date.now()}`;
  const viewQuery = {
    mongoQuery: [{ $match: { name: { $exists: true } } }],
  };

  function buildTestConnectionUri(): string {
    const base = process.env.DB_CONN_URI ?? 'mongodb://127.0.0.1:27017';
    const suffix = `conduit_view_race_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (base.startsWith('mongodb://') || base.startsWith('mongodb+srv://')) {
      const url = new URL(base);
      url.pathname = `/${suffix}`;
      return url.toString();
    }

    const hostOnly = base.replace(/^(mongodb(?:\+srv)?:\/\/[^/]+).*$/, '$1');
    return `${hostOnly}/${suffix}`;
  }

  async function setupAdapter(
    connectionUriValue: string,
    sdkName: string,
    deps: {
      ConduitGrpcSdk: typeof import('@conduitplatform/grpc-sdk').ConduitGrpcSdk;
      MongooseAdapter: typeof import('../../adapters/mongoose-adapter/index.js').MongooseAdapter;
      DeclaredSchema: import('@conduitplatform/grpc-sdk').ConduitSchema;
      Views: import('@conduitplatform/grpc-sdk').ConduitSchema;
      concurrentTestUserSchema: import('@conduitplatform/grpc-sdk').ConduitSchema;
    },
  ) {
    const grpcSdk = new deps.ConduitGrpcSdk('127.0.0.1:0', sdkName, false);
    await grpcSdk.initializeEventBus();

    const adapter = new deps.MongooseAdapter(connectionUriValue);
    await adapter.init(grpcSdk);

    await adapter.createSchemaFromAdapter(deps.DeclaredSchema, false, false, true);
    await adapter.createSchemaFromAdapter(deps.Views, false, false, true);
    await adapter.createSchemaFromAdapter(
      deps.concurrentTestUserSchema,
      false,
      false,
      true,
    );

    return { adapter, grpcSdk };
  }

  async function canReachIntegrationServices(): Promise<boolean> {
    const mongoUri = process.env.DB_CONN_URI!;
    const redisHost = process.env.REDIS_HOST!;
    const redisPort = Number(process.env.REDIS_PORT!);

    const { MongoClient } = await import('mongodb');
    const { default: Redis } = await import('ioredis');

    const mongoClient = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 2_000,
      connectTimeoutMS: 2_000,
    });
    const redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      connectTimeout: 2_000,
      maxRetriesPerRequest: 0,
      lazyConnect: true,
    });

    try {
      await mongoClient.connect();
      await redisClient.connect();
      await redisClient.ping();
      return true;
    } catch {
      return false;
    } finally {
      await mongoClient.close().catch(() => undefined);
      await redisClient.quit().catch(() => undefined);
    }
  }

  beforeAll(async () => {
    if (!integrationEnabled) {
      return;
    }

    if (!(await canReachIntegrationServices())) {
      servicesAvailable = false;
      console.warn(
        'Skipping integration test: MongoDB/Redis unreachable at configured endpoints.',
      );
      return;
    }

    try {
      const { ConduitGrpcSdk, ConduitSchema, TYPE } =
        await import('@conduitplatform/grpc-sdk');
      const { MongooseAdapter } =
        await import('../../adapters/mongoose-adapter/index.js');
      const { DeclaredSchema, Views } = await import('../../models/index.js');

      const concurrentTestUserSchema = new ConduitSchema(
        'ConcurrentTestUser',
        {
          _id: TYPE.ObjectId,
          name: { type: TYPE.String, required: false },
        },
        {
          timestamps: true,
          conduit: {
            permissions: {
              extendable: false,
              canCreate: true,
              canModify: 'Everything',
              canDelete: true,
            },
          },
        },
      );
      concurrentTestUserSchema.ownerModule = 'database';
      modelName = concurrentTestUserSchema.name;

      connectionUri = buildTestConnectionUri();
      const deps = {
        ConduitGrpcSdk,
        MongooseAdapter,
        DeclaredSchema,
        Views,
        concurrentTestUserSchema,
      };

      ({ adapter: adapterA, grpcSdk: grpcSdkA } = await setupAdapter(
        connectionUri,
        'database',
        deps,
      ));
      ({ adapter: adapterB, grpcSdk: grpcSdkB } = await setupAdapter(
        connectionUri,
        'database',
        deps,
      ));
    } catch (error) {
      servicesAvailable = false;
      setupError = error;
      await adapterA?.mongoose.disconnect().catch(() => undefined);
      await adapterB?.mongoose.disconnect().catch(() => undefined);
      console.warn('Integration test setup failed.', error);
    }
  }, 120_000);

  afterAll(async () => {
    const db = adapterA?.mongoose.connection.db;
    if (db) {
      await db.dropDatabase().catch(() => undefined);
    }
    await adapterA?.mongoose.disconnect().catch(() => undefined);
    await adapterB?.mongoose.disconnect().catch(() => undefined);
    await shutdownGrpcSdk(grpcSdkA);
    await shutdownGrpcSdk(grpcSdkB);
  }, 60_000);

  async function shutdownGrpcSdk(
    grpcSdk: import('@conduitplatform/grpc-sdk').ConduitGrpcSdk | undefined,
  ) {
    if (!grpcSdk) {
      return;
    }

    const state = grpcSdk.state as
      | (import('@conduitplatform/grpc-sdk').StateManager & {
          redisClient?: { quit: () => Promise<unknown> };
        })
      | null;
    const eventBus = grpcSdk.bus as {
      _clientSubscriber?: { quit: () => Promise<unknown> };
      _clientPublisher?: { quit: () => Promise<unknown> };
    } | null;

    await eventBus?._clientSubscriber?.quit().catch(() => undefined);
    await eventBus?._clientPublisher?.quit().catch(() => undefined);
    await state?.redisClient?.quit().catch(() => undefined);
  }

  it('concurrent createView same viewName: no throw, one physical view, both registered', async () => {
    if (!integrationEnabled) {
      return;
    }

    if (!servicesAvailable) {
      if (setupError) {
        throw setupError;
      }
      return;
    }

    const { isEqual } = await import('lodash-es');

    await expect(
      Promise.all([
        adapterA.createView(modelName, viewName, [modelName], viewQuery),
        adapterB.createView(modelName, viewName, [modelName], viewQuery),
      ]),
    ).resolves.toBeDefined();

    const collections = await adapterA.mongoose.connection
      .db!.listCollections({ name: viewName })
      .toArray();
    expect(collections).toHaveLength(1);
    expect(collections[0].options?.viewOn).toBeDefined();

    const metadata = await adapterA.models['Views'].findMany({ name: viewName });
    expect(metadata).toHaveLength(1);

    expect(adapterA.views[viewName]).toBeDefined();
    expect(adapterB.views[viewName]).toBeDefined();
    expect(isEqual(adapterA.views[viewName].viewQuery, viewQuery)).toBe(true);
    expect(isEqual(adapterB.views[viewName].viewQuery, viewQuery)).toBe(true);
  }, 120_000);
});
