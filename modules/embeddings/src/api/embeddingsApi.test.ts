import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GrpcError,
  TYPE,
  VectorCapabilities,
  VectorIndexStatus,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  EmbeddingsApi,
  type EmbeddingsApiDeps,
  type EmbeddingConfigRecord,
  type BackfillRunRecord,
  type SchemaInfo,
} from './embeddingsApi.js';
import type { Config } from '../config/index.js';
import type { QueueJobCounts } from '../controllers/queue.controller.js';
import { SearchGateError } from '../utils/operationalStatus.js';

const articleSchema = {
  name: 'Article',
  fields: { title: { type: TYPE.String }, body: { type: TYPE.String } },
  modelOptions: {
    conduit: {
      cms: { enabled: true },
      permissions: { extendable: true },
      authorization: { enabled: true },
    },
  },
};

const readyCapabilities = {
  supported: true,
  storage: true,
  indexing: true,
  search: true,
  provider: 'mongodb' as const,
};

const readyIndex = {
  field: 'embedding',
  name: 'embedding_vector',
  queryable: true,
  status: VectorIndexStatus.Ready,
  dimensions: 3,
  similarity: VectorSimilarity.Cosine,
};

const moduleConfig = {
  enabled: true,
  defaultProvider: 'openai-compatible',
  providers: {
    'openai-compatible': {
      endpoint: 'https://api.openai.com/v1/embeddings',
      apiKey: 'sk-test',
      models: [
        { name: 'text-embedding-3-small', dimensions: 3 },
        { name: 'text-embedding-3-large', dimensions: 3 },
        { name: 'text-embedding-3-wide', dimensions: 8 },
      ],
      defaultModel: 'text-embedding-3-small',
    },
  },
  queue: { concurrency: 1, attempts: 3, maxBatchSize: 50 },
  security: {
    sourceFieldAllowlist: [],
    maxMutationEventIds: 10,
    embedTimeoutMs: 1000,
    maxEmbedInputBytes: 1024,
    maxEmbedResponseBytes: 1024,
  },
} as Config;

function emptyCounts(): QueueJobCounts {
  return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 };
}

function createApi(overrides?: {
  configs?: EmbeddingConfigRecord[];
  runs?: BackfillRunRecord[];
  capabilities?: VectorCapabilities;
  indexes?: Array<{
    field?: string;
    name?: string;
    queryable?: boolean;
    status?: string;
    dimensions?: number;
    similarity?: string;
    method?: string;
  }>;
  schemas?: Record<string, SchemaInfo>;
  declared?: Record<
    string,
    {
      name: string;
      ownerModule: string;
      fields?: Record<string, unknown>;
      extensions?: Array<{ ownerModule: string; fields: Record<string, unknown> }>;
    }
  >;
  embed?: EmbeddingsApiDeps['embed'];
  vectorSearch?: EmbeddingsApiDeps['vectorSearch'];
  createVectorIndex?: EmbeddingsApiDeps['createVectorIndex'];
  createdIndexQueryable?: boolean;
  enqueue?: string[];
  invalidated?: string[];
  deletedIndexes?: string[];
  createdIndexes?: string[];
  schemaExtensions?: Array<{ schemaName: string; fields: Record<string, unknown> }>;
  config?: Config;
  queue?: { generation: QueueJobCounts; backfill: QueueJobCounts };
}) {
  const configs = [...(overrides?.configs ?? [])];
  const runs = [...(overrides?.runs ?? [])];
  const indexes = [...(overrides?.indexes ?? [readyIndex])];
  const enqueued = overrides?.enqueue ?? [];
  const invalidated = overrides?.invalidated ?? [];
  const deletedIndexes = overrides?.deletedIndexes ?? [];
  const createdIndexes = overrides?.createdIndexes ?? [];
  const schemaExtensions = overrides?.schemaExtensions ?? [];
  const deps: EmbeddingsApiDeps = {
    currentConfig: () => overrides?.config ?? moduleConfig,
    getSchema: async name => {
      const schema =
        overrides?.schemas?.[name] ?? (name === 'Article' ? articleSchema : undefined);
      if (!schema) throw new GrpcError(status.NOT_FOUND, `Schema ${name} not found`);
      return schema;
    },
    declaredSchema: async name =>
      overrides?.declared?.[name] ?? { name, ownerModule: 'database' },
    setSchemaExtension: async args => {
      schemaExtensions.push(args);
      return undefined;
    },
    getVectorCapabilities: async () => overrides?.capabilities ?? readyCapabilities,
    getVectorIndexes: async () => indexes,
    vectorSearch: overrides?.vectorSearch ?? (async () => []),
    configs: {
      findMany: async query =>
        configs.filter(config =>
          Object.entries(query).every(([key, value]) => (config as never)[key] === value),
        ),
      findOne: async query =>
        configs.find(config =>
          Object.entries(query).every(([key, value]) => (config as never)[key] === value),
        ) ?? null,
      create: async doc => {
        const created = {
          _id: `cfg${configs.length + 1}`,
          ...doc,
        } as EmbeddingConfigRecord;
        configs.push(created);
        return created;
      },
      findByIdAndUpdate: async (id, doc) => {
        const index = configs.findIndex(config => config._id === id);
        if (index < 0) return null;
        configs[index] = { ...configs[index], ...doc };
        return configs[index];
      },
      deleteOne: async query => {
        const index = configs.findIndex(config =>
          Object.entries(query).every(([key, value]) => (config as never)[key] === value),
        );
        if (index >= 0) configs.splice(index, 1);
      },
    },
    backfills: {
      findMany: async (query, options) => {
        const matched = runs.filter(run =>
          Object.entries(query).every(([key, value]) => (run as never)[key] === value),
        );
        const skip = options?.skip ?? 0;
        const limit = options?.limit ?? matched.length;
        return matched.slice(skip, skip + limit);
      },
      findOne: async query =>
        runs.find(run =>
          Object.entries(query).every(([key, value]) => (run as never)[key] === value),
        ) ?? null,
      countDocuments: async query =>
        runs.filter(run =>
          Object.entries(query).every(([key, value]) => (run as never)[key] === value),
        ).length,
      create: async doc => {
        const created = {
          _id: `run${runs.length + 1}`,
          ...doc,
        } as BackfillRunRecord;
        runs.push(created);
        return { _id: created._id };
      },
      findByIdAndUpdate: async (id, doc) => {
        const index = runs.findIndex(run => run._id === id);
        if (index < 0) return null;
        runs[index] = { ...runs[index], ...doc } as BackfillRunRecord;
        return runs[index];
      },
    },
    getQueueStatus: async () =>
      overrides?.queue ?? {
        generation: { ...emptyCounts(), waiting: 2 },
        backfill: emptyCounts(),
      },
    enqueueBackfill: async job => {
      enqueued.push(job.runId);
    },
    createVectorIndex:
      overrides?.createVectorIndex ??
      (async (_schema, index) => {
        const name = index.name ?? `${index.field}_vector`;
        createdIndexes.push(name);
        if (!indexes.some(item => item.name === name)) {
          indexes.push({
            field: index.field,
            name,
            dimensions: index.dimensions,
            similarity: index.similarity,
            method: index.method,
            queryable: overrides?.createdIndexQueryable === true,
            status:
              overrides?.createdIndexQueryable === true
                ? VectorIndexStatus.Ready
                : VectorIndexStatus.Pending,
          });
        }
        return 'created';
      }),
    deleteVectorIndex: async (_schema, indexName) => {
      deletedIndexes.push(indexName);
      const index = indexes.findIndex(item => item.name === indexName);
      if (index >= 0) indexes.splice(index, 1);
      return 'deleted';
    },
    invalidateHashes: async (schemaName, hashFields) => {
      invalidated.push(...hashFields.map(field => `${schemaName}.${field}`));
    },
    embed:
      overrides?.embed ??
      (async () => Array.from({ length: 3 }, (_, index) => index + 0.1)),
  };
  return {
    api: new EmbeddingsApi(deps),
    configs,
    runs,
    enqueued,
    invalidated,
    deletedIndexes,
    createdIndexes,
    schemaExtensions,
    indexes,
  };
}

const enabledConfig: EmbeddingConfigRecord = {
  _id: 'cfg1',
  schemaName: 'Article',
  sourceFields: ['title'],
  targetField: 'embedding',
  provider: 'openai-compatible',
  modelName: 'text-embedding-3-small',
  dimensions: 3,
  similarity: 'cosine',
  enabled: true,
};

describe('typed embeddings API handlers', () => {
  it('upserts a typed config and provisions a missing vector index on first save', async () => {
    const { api, configs, createdIndexes } = createApi({ indexes: [] });
    const saved = await api.upsertConfig(
      {
        schemaName: 'Article',
        sourceFields: ['title'],
        targetField: 'embedding',
        provider: 'openai-compatible',
        model: 'text-embedding-3-small',
        dimensions: 3,
        enabled: true,
      },
      { callerModule: 'database' },
    );
    assert.equal(saved.config.enabled, false);
    assert.equal(saved.config.model, 'text-embedding-3-small');
    assert.equal(typeof saved.config.id, 'string');
    assert.equal(createdIndexes.includes('embedding_vector'), true);
    assert.equal(
      saved.warnings.some(warning => /not queryable/.test(warning)),
      true,
    );
    assert.equal(
      saved.warnings.some(warning =>
        /saved disabled until the provisioned vector index/.test(warning),
      ),
      true,
    );
    assert.equal(configs.length, 1);
    assert.equal(configs[0].enabled, false);
  });

  it('saves the config disabled when vector index provisioning fails', async () => {
    const { api, configs, createdIndexes } = createApi({
      indexes: [],
      createVectorIndex: async () => {
        throw new Error('atlas search index rejected');
      },
    });
    const saved = await api.upsertConfig(
      {
        schemaName: 'Article',
        sourceFields: ['title'],
        targetField: 'embedding',
        provider: 'openai-compatible',
        model: 'text-embedding-3-small',
        dimensions: 3,
        enabled: true,
      },
      { callerModule: 'database' },
    );
    assert.equal(saved.config.enabled, false);
    assert.equal(configs.length, 1);
    assert.equal(configs[0].enabled, false);
    assert.equal(createdIndexes.length, 0);
    assert.equal(
      saved.warnings.some(
        warning =>
          /saved disabled because vector index provisioning failed/.test(warning) &&
          /atlas search index rejected/.test(warning) &&
          /queryable/.test(warning),
      ),
      true,
    );
  });

  it('saves the updated config disabled when index recreation fails', async () => {
    const { api, configs, deletedIndexes } = createApi({
      configs: [enabledConfig],
      createVectorIndex: async () => {
        throw new Error('recreate rejected');
      },
    });
    const saved = await api.upsertConfig(
      {
        schemaName: 'Article',
        sourceFields: ['title'],
        targetField: 'embedding',
        provider: 'openai-compatible',
        model: 'text-embedding-3-small',
        dimensions: 3,
        similarity: VectorSimilarity.Euclidean,
        enabled: true,
      },
      { callerModule: 'database' },
    );
    assert.equal(saved.config.enabled, false);
    assert.equal(configs[0].enabled, false);
    assert.deepEqual(deletedIndexes, []);
    assert.equal(
      saved.warnings.some(
        warning =>
          /saved disabled because vector index provisioning failed/.test(warning) &&
          /recreate rejected/.test(warning),
      ),
      true,
    );
  });

  it('reports a manual index lifecycle when Database indexing is unavailable', async () => {
    const { api, createdIndexes } = createApi({
      indexes: [],
      capabilities: {
        supported: true,
        storage: true,
        indexing: false,
        search: false,
        provider: 'mongodb',
        reason: 'indexing unavailable',
      },
    });
    const saved = await api.upsertConfig(
      {
        schemaName: 'Article',
        sourceFields: ['title'],
        targetField: 'embedding',
        provider: 'openai-compatible',
        model: 'text-embedding-3-small',
        dimensions: 3,
        enabled: true,
      },
      { callerModule: 'database' },
    );
    assert.equal(saved.config.enabled, false);
    assert.equal(createdIndexes.length, 0);
    assert.equal(
      saved.warnings.some(warning => /Create the index manually/.test(warning)),
      true,
    );
  });

  it('does not recreate _vN indexes when live method is empty or missing', async () => {
    const missingMethod = {
      ...readyIndex,
      method: undefined,
    };
    const emptyMethod = {
      ...readyIndex,
      method: '',
    };
    for (const indexes of [[missingMethod], [emptyMethod]]) {
      const { api, createdIndexes, deletedIndexes } = createApi({
        configs: [enabledConfig],
        indexes,
      });
      const saved = await api.upsertConfig(
        {
          schemaName: 'Article',
          sourceFields: ['title'],
          targetField: 'embedding',
          provider: 'openai-compatible',
          model: 'text-embedding-3-small',
          dimensions: 3,
          similarity: VectorSimilarity.Cosine,
          enabled: true,
        },
        { callerModule: 'database' },
      );
      assert.equal(saved.config.enabled, true);
      assert.deepEqual(createdIndexes, []);
      assert.deepEqual(deletedIndexes, []);
    }
  });

  it('gates system schemas and owner policies on config and backfill', async () => {
    const { api } = createApi({
      declared: { Article: { name: 'Article', ownerModule: 'cms-app' } },
      schemas: {
        Article: articleSchema,
        AccessToken: {
          name: 'AccessToken',
          fields: { token: { type: TYPE.String } },
        },
      },
    });
    await assert.rejects(
      () =>
        api.upsertConfig(
          {
            schemaName: 'AccessToken',
            sourceFields: ['token'],
            targetField: 'embedding',
            model: 'text-embedding-3-small',
            dimensions: 3,
            enabled: false,
          },
          { platformAdmin: true },
        ),
      (err: unknown) => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
    await assert.rejects(
      () => api.startBackfill({ schemaName: 'Article' }, { callerModule: 'chat' }),
      (err: unknown) => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
    await assert.rejects(
      () => api.getConfigs({}, { callerModule: 'chat' }),
      (err: unknown) => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
  });

  it('ignores caller-supplied sourceFieldAllowlist for schema-owner gRPC callers', async () => {
    const sensitiveSchema = {
      name: 'Article',
      fields: {
        title: { type: TYPE.String },
        password: { type: TYPE.String },
        notes: { type: TYPE.String, select: false },
      },
      modelOptions: articleSchema.modelOptions,
    };
    const owner = { callerModule: 'cms-app' };
    const declared = { Article: { name: 'Article', ownerModule: 'cms-app' } };
    const { api: ownerApi } = createApi({
      schemas: { Article: sensitiveSchema },
      declared,
      indexes: [readyIndex],
    });
    await assert.rejects(
      () =>
        ownerApi.upsertConfig(
          {
            schemaName: 'Article',
            sourceFields: ['password'],
            targetField: 'embedding',
            model: 'text-embedding-3-small',
            dimensions: 3,
            sourceFieldAllowlist: ['password'],
            enabled: false,
          },
          owner,
        ),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        /sensitive/.test(err.message),
    );
    await assert.rejects(
      () =>
        ownerApi.upsertConfig(
          {
            schemaName: 'Article',
            sourceFields: ['notes'],
            targetField: 'embedding',
            model: 'text-embedding-3-small',
            dimensions: 3,
            sourceFieldAllowlist: ['notes'],
            enabled: false,
          },
          owner,
        ),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        /hidden/.test(err.message),
    );
    await assert.rejects(
      () =>
        ownerApi.upsertConfig(
          {
            schemaName: 'Article',
            sourceFields: ['password'],
            targetField: 'embedding',
            model: 'text-embedding-3-small',
            dimensions: 3,
            sourceFieldAllowlist: ['password'],
            enabled: false,
          },
          { callerModule: 'database' },
        ),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        /sensitive/.test(err.message),
    );

    const { api: operatorAllowlistApi } = createApi({
      schemas: { Article: sensitiveSchema },
      declared,
      indexes: [readyIndex],
      config: {
        ...moduleConfig,
        security: { ...moduleConfig.security, sourceFieldAllowlist: ['notes'] },
      } as Config,
    });
    const operatorSaved = await operatorAllowlistApi.upsertConfig(
      {
        schemaName: 'Article',
        sourceFields: ['notes'],
        targetField: 'embedding',
        model: 'text-embedding-3-small',
        dimensions: 3,
        enabled: false,
      },
      owner,
    );
    assert.equal(operatorSaved.config.enabled, false);

    const { api: adminApi } = createApi({
      schemas: { Article: sensitiveSchema },
      declared,
      indexes: [readyIndex],
    });
    const adminSaved = await adminApi.upsertConfig(
      {
        schemaName: 'Article',
        sourceFields: ['notes'],
        targetField: 'embedding',
        model: 'text-embedding-3-small',
        dimensions: 3,
        sourceFieldAllowlist: ['notes'],
        enabled: false,
      },
      { platformAdmin: true },
    );
    assert.equal(adminSaved.config.enabled, false);
  });

  it('starts, lists, cancels, and resumes persisted backfill runs with onlyMissing', async () => {
    const { api, runs, enqueued } = createApi({ configs: [enabledConfig] });
    const started = await api.startBackfill(
      { schemaName: 'Article', onlyMissing: true, batchSize: 10 },
      { callerModule: 'database' },
    );
    assert.equal(started.queued, 1);
    assert.equal(started.runs[0].onlyMissing, true);
    assert.equal(started.runs[0].state, 'queued');
    assert.equal(enqueued.length, 1);
    const listed = await api.listBackfills(
      { schemaName: 'Article' },
      { callerModule: 'database' },
    );
    assert.equal(listed.count, 1);
    const gotten = await api.getBackfill(started.runs[0].id, {
      callerModule: 'database',
    });
    assert.equal(gotten.queuedCount, 0);
    const canceled = await api.cancelBackfill(started.runs[0].id, {
      callerModule: 'database',
    });
    assert.equal(canceled.run.state, 'canceled');
    const resumed = await api.resumeBackfill(started.runs[0].id, {
      callerModule: 'database',
    });
    assert.equal(resumed.run.state, 'queued');
    assert.equal(runs[0].state, 'queued');
    await assert.rejects(
      () => api.cancelBackfill('missing', { platformAdmin: true }),
      (err: unknown) => err instanceof GrpcError && err.code === status.NOT_FOUND,
    );
  });

  it('returns typed status, queue counts, and capability warnings', async () => {
    const { api } = createApi({
      capabilities: {
        supported: false,
        storage: false,
        indexing: false,
        search: false,
        provider: 'unsupported',
        reason: 'mysql is storage-only',
      },
      config: { ...moduleConfig, enabled: false },
      queue: {
        generation: { ...emptyCounts(), waiting: 4, failed: 1 },
        backfill: { ...emptyCounts(), active: 1 },
      },
    });
    const statusResult = await api.getStatus();
    assert.equal(statusResult.enabled, false);
    assert.equal(statusResult.ready, false);
    assert.equal(statusResult.generationQueue.waiting, 4);
    assert.equal(statusResult.backfillQueue.active, 1);
    assert.equal(
      statusResult.warnings.some(warning => /disabled/.test(warning)),
      true,
    );
    assert.equal(
      statusResult.warnings.some(warning => /mysql is storage-only/.test(warning)),
      true,
    );
    const capabilities = await api.getCapabilities('Article');
    assert.equal(capabilities.capabilities.search, false);
  });

  it('runs semantic search with typed hits and fail-closed auth', async () => {
    const embedCalls: Array<[string, string, string]> = [];
    const { api } = createApi({
      configs: [enabledConfig],
      embed: async (input, provider, model) => {
        embedCalls.push([input, provider, model]);
        return [0.1, 1.1, 2.1];
      },
      vectorSearch: async input => {
        assert.equal(input.userId, 'user-1');
        assert.equal(input.adminOperator, false);
        assert.deepEqual(input.vector, [0.1, 1.1, 2.1]);
        return [
          {
            document: { _id: 'doc1', title: 'Hello' },
            score: 0.91,
            distance: 0.09,
            metric: VectorSimilarity.Cosine,
            provider: 'mongodb',
          },
        ];
      },
    });
    await assert.rejects(
      () =>
        api.semanticSearch(
          { schemaName: 'Article', text: 'hello' },
          { callerModule: 'database' },
        ),
      (err: unknown) => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
    const result = await api.semanticSearch(
      { schemaName: 'Article', text: 'hello', userId: 'user-1' },
      { callerModule: 'database' },
    );
    assert.deepEqual(embedCalls, [
      ['hello', 'openai-compatible', 'text-embedding-3-small'],
    ]);
    assert.equal(result.hits.length, 1);
    assert.equal(JSON.parse(result.hits[0].document)._id, 'doc1');
    assert.equal(result.hits[0].score, 0.91);
    const mapped = api.mapGrpcError(
      new GrpcError(status.FAILED_PRECONDITION, 'index not ready'),
    );
    assert.equal(mapped.code, status.FAILED_PRECONDITION);
  });

  it('caps client semantic-search limit below admin and gRPC callers', async () => {
    const seen: number[] = [];
    const { api } = createApi({
      configs: [enabledConfig],
      vectorSearch: async input => {
        seen.push(input.limit ?? -1);
        return [];
      },
    });
    await api.semanticSearch(
      { schemaName: 'Article', text: 'hello', userId: 'user-1', limit: 1000 },
      { callerModule: 'router' },
    );
    await api.semanticSearch(
      { schemaName: 'Article', text: 'hello', userId: 'user-1', limit: 1000 },
      { callerModule: 'database' },
    );
    await api.semanticSearch(
      { schemaName: 'Article', text: 'hello', userId: 'user-1', limit: 1000 },
      { platformAdmin: true },
    );
    assert.deepEqual(seen, [50, 1000, 1000]);
  });

  it('maps provider dimension mismatches and illegal backfill transitions to typed statuses', async () => {
    const { api } = createApi({
      configs: [enabledConfig],
      embed: async () => [1, 2],
    });
    await assert.rejects(
      () =>
        api.semanticSearch(
          { schemaName: 'Article', text: 'hello', userId: 'user-1' },
          { callerModule: 'database' },
        ),
      (err: unknown) =>
        err instanceof GrpcError && err.code === status.FAILED_PRECONDITION,
    );
    const started = await createApi({ configs: [enabledConfig] }).api.startBackfill(
      { schemaName: 'Article' },
      { callerModule: 'database' },
    );
    const { api: resumeApi } = createApi({
      configs: [enabledConfig],
      runs: [
        {
          _id: started.runs[0].id,
          schemaName: 'Article',
          configId: 'cfg1',
          state: 'completed',
          batchSize: 10,
          onlyMissing: false,
          scannedCount: 1,
          queuedCount: 1,
          processedCount: 1,
          failedCount: 0,
        },
      ],
    });
    await assert.rejects(
      () => resumeApi.resumeBackfill(started.runs[0].id, { callerModule: 'database' }),
      (err: unknown) =>
        err instanceof GrpcError && err.code === status.FAILED_PRECONDITION,
    );
  });

  it('invalidates hashes, recreates the index, and schedules a backfill on material config changes', async () => {
    const { api, invalidated, deletedIndexes, createdIndexes, enqueued, runs } =
      createApi({
        configs: [enabledConfig],
        createdIndexQueryable: true,
      });
    await assert.rejects(
      () =>
        api.upsertConfig(
          {
            schemaName: 'Article',
            sourceFields: ['title'],
            targetField: 'embedding',
            provider: 'openai-compatible',
            model: 'text-embedding-3-wide',
            dimensions: 8,
            enabled: false,
          },
          { callerModule: 'database' },
        ),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.FAILED_PRECONDITION &&
        /dimensions/.test(err.message),
    );

    const updated = await api.upsertConfig(
      {
        schemaName: 'Article',
        sourceFields: ['title', 'body'],
        targetField: 'embedding',
        provider: 'openai-compatible',
        model: 'text-embedding-3-large',
        dimensions: 3,
        similarity: VectorSimilarity.Euclidean,
        enabled: true,
      },
      { callerModule: 'database' },
    );
    assert.equal(updated.config.model, 'text-embedding-3-large');
    assert.deepEqual(invalidated, ['Article.embeddingSourceHash']);
    assert.deepEqual(createdIndexes, ['embedding_vector_v2']);
    assert.deepEqual(deletedIndexes, ['embedding_vector']);
    assert.equal(enqueued.length, 1);
    assert.equal(runs[0].state, 'queued');
    assert.equal(runs[0].onlyMissing, false);
    assert.equal(
      updated.warnings.some(warning => /explicit backfill was scheduled/.test(warning)),
      true,
    );
  });

  it('keeps the previous index when replacement provisioning fails', async () => {
    const { api, configs, deletedIndexes, createdIndexes, indexes } = createApi({
      configs: [enabledConfig],
      createVectorIndex: async () => {
        throw new Error('atlas rejected replacement');
      },
    });
    const saved = await api.upsertConfig(
      {
        schemaName: 'Article',
        sourceFields: ['title'],
        targetField: 'embedding',
        provider: 'openai-compatible',
        model: 'text-embedding-3-small',
        dimensions: 3,
        similarity: VectorSimilarity.Euclidean,
        enabled: true,
      },
      { callerModule: 'database' },
    );
    assert.equal(saved.config.enabled, false);
    assert.equal(configs[0].enabled, false);
    assert.deepEqual(createdIndexes, []);
    assert.deepEqual(deletedIndexes, []);
    assert.equal(
      indexes.some(index => index.name === 'embedding_vector' && index.queryable),
      true,
    );
    assert.equal(
      saved.warnings.some(
        warning =>
          /saved disabled because vector index provisioning failed/.test(warning) &&
          /atlas rejected replacement/.test(warning),
      ),
      true,
    );
  });

  it('keeps the previous index while a versioned replacement is not queryable', async () => {
    const { api, configs, deletedIndexes, createdIndexes, indexes, enqueued } = createApi(
      {
        configs: [enabledConfig],
      },
    );
    const saved = await api.upsertConfig(
      {
        schemaName: 'Article',
        sourceFields: ['title'],
        targetField: 'embedding',
        provider: 'openai-compatible',
        model: 'text-embedding-3-small',
        dimensions: 3,
        similarity: VectorSimilarity.Euclidean,
        enabled: true,
      },
      { callerModule: 'database' },
    );
    assert.equal(saved.config.enabled, false);
    assert.equal(configs[0].enabled, false);
    assert.deepEqual(createdIndexes, ['embedding_vector_v2']);
    assert.deepEqual(deletedIndexes, []);
    assert.equal(
      indexes.some(index => index.name === 'embedding_vector' && index.queryable),
      true,
    );
    assert.equal(
      indexes.some(
        index => index.name === 'embedding_vector_v2' && index.queryable !== true,
      ),
      true,
    );
    assert.equal(enqueued.length, 0);
    assert.equal(
      saved.warnings.some(warning =>
        /saved disabled until the provisioned vector index/.test(warning),
      ),
      true,
    );
  });

  it('retires the previous index after a pending replacement becomes queryable', async () => {
    const pendingReplacement = {
      field: 'embedding',
      name: 'embedding_vector_v2',
      queryable: false,
      status: VectorIndexStatus.Pending,
      dimensions: 3,
      similarity: VectorSimilarity.Euclidean,
    };
    const { api, configs, deletedIndexes, createdIndexes, indexes, enqueued } = createApi(
      {
        configs: [
          { ...enabledConfig, similarity: VectorSimilarity.Euclidean, enabled: false },
        ],
        indexes: [readyIndex, pendingReplacement],
      },
    );
    pendingReplacement.queryable = true;
    pendingReplacement.status = VectorIndexStatus.Ready;
    const saved = await api.upsertConfig(
      {
        schemaName: 'Article',
        sourceFields: ['title'],
        targetField: 'embedding',
        provider: 'openai-compatible',
        model: 'text-embedding-3-small',
        dimensions: 3,
        similarity: VectorSimilarity.Euclidean,
        enabled: true,
      },
      { callerModule: 'database' },
    );
    assert.equal(saved.config.enabled, true);
    assert.equal(configs[0].enabled, true);
    assert.deepEqual(createdIndexes, []);
    assert.deepEqual(deletedIndexes, ['embedding_vector']);
    assert.equal(
      indexes.some(index => index.name === 'embedding_vector'),
      false,
    );
    assert.equal(
      indexes.some(index => index.name === 'embedding_vector_v2' && index.queryable),
      true,
    );
    assert.equal(enqueued.length, 0);
  });

  it('retries a failed similarity recreation without enabling the mismatched live index', async () => {
    let attempts = 0;
    const createdIndexes: string[] = [];
    const { api, configs, deletedIndexes, indexes } = createApi({
      configs: [enabledConfig],
      createdIndexes,
      createVectorIndex: async (_schema, index) => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('atlas rejected replacement');
        }
        const name = index.name ?? `${index.field}_vector`;
        createdIndexes.push(name);
        indexes.push({
          field: index.field,
          name,
          dimensions: index.dimensions,
          similarity: index.similarity,
          queryable: false,
          status: VectorIndexStatus.Pending,
        });
        return 'created';
      },
    });
    const euclideanUpsert = {
      schemaName: 'Article',
      sourceFields: ['title'],
      targetField: 'embedding',
      provider: 'openai-compatible',
      model: 'text-embedding-3-small',
      dimensions: 3,
      similarity: VectorSimilarity.Euclidean,
      enabled: true,
    };
    const first = await api.upsertConfig(euclideanUpsert, { callerModule: 'database' });
    assert.equal(first.config.enabled, false);
    assert.deepEqual(createdIndexes, []);
    assert.deepEqual(deletedIndexes, []);

    const retry = await api.upsertConfig(euclideanUpsert, { callerModule: 'database' });
    assert.equal(retry.config.enabled, false);
    assert.equal(configs[0].enabled, false);
    assert.deepEqual(createdIndexes, ['embedding_vector_v2']);
    assert.deepEqual(deletedIndexes, []);
    assert.equal(
      indexes.some(index => index.name === 'embedding_vector' && index.queryable),
      true,
    );
    assert.equal(
      indexes.some(
        index =>
          index.name === 'embedding_vector_v2' &&
          index.similarity === VectorSimilarity.Euclidean &&
          index.queryable !== true,
      ),
      true,
    );
    await assert.rejects(
      () =>
        api.semanticSearch(
          { schemaName: 'Article', text: 'hello', userId: 'user-1' },
          { callerModule: 'database' },
        ),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.NOT_FOUND &&
        /No embedding config found/.test(err.message),
    );
  });

  it('denies activation when the live index contract does not match', async () => {
    const { api, configs, deletedIndexes, createdIndexes, indexes } = createApi({
      configs: [
        { ...enabledConfig, similarity: VectorSimilarity.Euclidean, enabled: false },
      ],
      capabilities: {
        ...readyCapabilities,
        indexing: false,
        reason: 'indexing unavailable',
      },
    });
    const saved = await api.upsertConfig(
      {
        schemaName: 'Article',
        sourceFields: ['title'],
        targetField: 'embedding',
        provider: 'openai-compatible',
        model: 'text-embedding-3-small',
        dimensions: 3,
        similarity: VectorSimilarity.Euclidean,
        enabled: true,
      },
      { callerModule: 'database' },
    );
    assert.equal(saved.config.enabled, false);
    assert.equal(configs[0].enabled, false);
    assert.deepEqual(createdIndexes, []);
    assert.deepEqual(deletedIndexes, []);
    assert.equal(
      indexes.some(
        index =>
          index.name === 'embedding_vector' &&
          index.queryable &&
          index.similarity === VectorSimilarity.Cosine,
      ),
      true,
    );
    assert.equal(
      saved.warnings.some(warning => /not queryable/.test(warning)),
      true,
    );
    await assert.rejects(
      () =>
        api.semanticSearch(
          { schemaName: 'Article', text: 'hello', userId: 'user-1' },
          { callerModule: 'database' },
        ),
      (err: unknown) =>
        err instanceof GrpcError &&
        (err.code === status.NOT_FOUND || err.code === status.FAILED_PRECONDITION),
    );
  });

  it('does not search through a queryable index that does not match the config contract', async () => {
    let searched = false;
    const { api } = createApi({
      configs: [
        { ...enabledConfig, similarity: VectorSimilarity.Euclidean, enabled: true },
      ],
      vectorSearch: async () => {
        searched = true;
        return [];
      },
    });
    await assert.rejects(
      () =>
        api.semanticSearch(
          { schemaName: 'Article', text: 'hello', userId: 'user-1' },
          { callerModule: 'database' },
        ),
      (err: unknown) =>
        err instanceof SearchGateError &&
        err.reason === 'index_not_queryable' &&
        api.mapGrpcError(err).code === status.FAILED_PRECONDITION,
    );
    assert.equal(searched, false);
  });

  it('is idempotent for start, cancel, and resume and does not duplicate active runs', async () => {
    const { api, runs, enqueued } = createApi({ configs: [enabledConfig] });
    const first = await api.startBackfill(
      { schemaName: 'Article', configId: 'cfg1' },
      { callerModule: 'database' },
    );
    const second = await api.startBackfill(
      { schemaName: 'Article', configId: 'cfg1' },
      { callerModule: 'database' },
    );
    assert.equal(first.runs[0].id, second.runs[0].id);
    assert.equal(runs.filter(run => run.state === 'queued').length, 1);
    const canceled = await api.cancelBackfill(first.runs[0].id, {
      callerModule: 'database',
    });
    assert.equal(canceled.run.state, 'canceled');
    const canceledAgain = await api.cancelBackfill(first.runs[0].id, {
      callerModule: 'database',
    });
    assert.equal(canceledAgain.run.state, 'canceled');
    const resumed = await api.resumeBackfill(first.runs[0].id, {
      callerModule: 'database',
    });
    assert.equal(resumed.run.state, 'queued');
    const resumedAgain = await api.resumeBackfill(first.runs[0].id, {
      callerModule: 'database',
    });
    assert.equal(resumedAgain.run.state, 'queued');
    assert.equal(enqueued.length >= 2, true);
  });

  it('rejects unknown providers, unknown models, and explicit catalogue dimension mismatches', async () => {
    const { api } = createApi();
    await assert.rejects(
      () =>
        api.upsertConfig(
          {
            schemaName: 'Article',
            sourceFields: ['title'],
            targetField: 'embedding',
            provider: 'missing',
            model: 'text-embedding-3-small',
            enabled: false,
          },
          { callerModule: 'database' },
        ),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        /not a configured provider/.test(err.message),
    );
    await assert.rejects(
      () =>
        api.upsertConfig(
          {
            schemaName: 'Article',
            sourceFields: ['title'],
            targetField: 'embedding',
            model: 'missing-model',
            enabled: false,
          },
          { callerModule: 'database' },
        ),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        /not in the catalogue/.test(err.message),
    );
    await assert.rejects(
      () =>
        api.upsertConfig(
          {
            schemaName: 'Article',
            sourceFields: ['title'],
            targetField: 'embedding',
            model: 'text-embedding-3-small',
            dimensions: 1536,
            enabled: false,
          },
          { callerModule: 'database' },
        ),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        /do not match catalogue dimensions/.test(err.message),
    );
  });

  it('derives dimensions from the catalogue when the client omits them', async () => {
    const { api, configs } = createApi({ indexes: [readyIndex] });
    const saved = await api.upsertConfig(
      {
        schemaName: 'Article',
        sourceFields: ['title'],
        targetField: 'embedding',
        model: 'text-embedding-3-small',
        enabled: false,
      },
      { callerModule: 'database' },
    );
    assert.equal(saved.config.dimensions, 3);
    assert.equal(configs[0].dimensions, 3);
    assert.equal(saved.config.model, 'text-embedding-3-small');
  });

  it('selects the catalogue default model when upsert omits model', async () => {
    const { api, configs } = createApi({
      indexes: [readyIndex],
      config: {
        ...moduleConfig,
        providers: {
          'openai-compatible': {
            ...moduleConfig.providers['openai-compatible'],
            defaultModel: 'text-embedding-3-large',
          },
        },
      },
    });
    const saved = await api.upsertConfig(
      {
        schemaName: 'Article',
        sourceFields: ['title'],
        targetField: 'embedding',
        enabled: false,
      },
      { callerModule: 'database' },
    );
    assert.equal(saved.config.model, 'text-embedding-3-large');
    assert.equal(saved.config.dimensions, 3);
    assert.equal(configs[0].modelName, 'text-embedding-3-large');
  });

  it('reports catalogue readiness on status without leaking provider secrets', async () => {
    const { api } = createApi({
      config: {
        ...moduleConfig,
        providers: {
          'openai-compatible': {
            endpoint: 'https://api.openai.com/v1/embeddings',
            apiKey: 'sk-status',
            models: [],
            defaultModel: 'missing',
          },
        },
      },
    });
    const statusResult = await api.getStatus();
    assert.equal(statusResult.ready, false);
    assert.equal(
      statusResult.warnings.some(warning => /model catalogue is empty/.test(warning)),
      true,
    );
    assert.equal(JSON.stringify(statusResult).includes('sk-status'), false);
    const capabilities = await api.getCapabilities();
    assert.deepEqual(Object.keys(capabilities.capabilities).sort(), [
      'indexing',
      'provider',
      'search',
      'storage',
      'supported',
    ]);
  });

  it('rejects CMS-enabled schemas that are not extendable', async () => {
    const { api, configs, createdIndexes, schemaExtensions } = createApi({
      schemas: {
        Article: {
          ...articleSchema,
          modelOptions: {
            conduit: {
              cms: { enabled: true },
              permissions: { extendable: false },
              authorization: { enabled: true },
            },
          },
        },
      },
    });
    await assert.rejects(
      () =>
        api.upsertConfig(
          {
            schemaName: 'Article',
            sourceFields: ['title'],
            targetField: 'embedding',
            model: 'text-embedding-3-small',
            enabled: false,
          },
          { callerModule: 'database' },
        ),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.FAILED_PRECONDITION &&
        /not extendable/.test(err.message),
    );
    assert.equal(configs.length, 0);
    assert.equal(createdIndexes.length, 0);
    assert.equal(schemaExtensions.length, 0);
  });

  it('rejects incompatible field collisions before provisioning extensions or indexes', async () => {
    const { api, configs, createdIndexes, schemaExtensions } = createApi({
      schemas: {
        Article: {
          ...articleSchema,
          fields: {
            ...articleSchema.fields,
            embedding: { type: TYPE.String },
          },
        },
      },
      declared: {
        Article: {
          name: 'Article',
          ownerModule: 'database',
          fields: {
            title: { type: TYPE.String },
            body: { type: TYPE.String },
            embedding: { type: TYPE.String },
          },
        },
      },
    });
    await assert.rejects(
      () =>
        api.upsertConfig(
          {
            schemaName: 'Article',
            sourceFields: ['title'],
            targetField: 'embedding',
            model: 'text-embedding-3-small',
            enabled: false,
          },
          { callerModule: 'database' },
        ),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.ALREADY_EXISTS &&
        /not a compatible embeddings extension/.test(err.message),
    );
    assert.equal(configs.length, 0);
    assert.equal(createdIndexes.length, 0);
    assert.equal(schemaExtensions.length, 0);
  });

  it('is idempotent for compatible existing embeddings extensions', async () => {
    const compatibleFields = {
      embedding: {
        type: TYPE.Vector,
        dimensions: 3,
        similarity: VectorSimilarity.Cosine,
        select: false,
      },
      embeddingSourceHash: { type: TYPE.String, required: false, select: false },
      otherEmbedding: {
        type: TYPE.Vector,
        dimensions: 3,
        similarity: VectorSimilarity.Cosine,
        select: false,
      },
    };
    const { api, configs, schemaExtensions } = createApi({
      indexes: [readyIndex],
      schemas: {
        Article: {
          ...articleSchema,
          fields: {
            ...articleSchema.fields,
            ...compatibleFields,
          },
        },
      },
      declared: {
        Article: {
          name: 'Article',
          ownerModule: 'database',
          fields: articleSchema.fields,
          extensions: [
            {
              ownerModule: 'embeddings',
              fields: compatibleFields,
            },
          ],
        },
      },
    });
    const saved = await api.upsertConfig(
      {
        schemaName: 'Article',
        sourceFields: ['title'],
        targetField: 'embedding',
        model: 'text-embedding-3-small',
        enabled: false,
      },
      { callerModule: 'database' },
    );
    assert.equal(saved.config.enabled, false);
    assert.equal(configs.length, 1);
    assert.equal(schemaExtensions.length, 1);
    assert.equal('otherEmbedding' in schemaExtensions[0].fields, true);
    assert.equal('embedding' in schemaExtensions[0].fields, true);
  });
});
