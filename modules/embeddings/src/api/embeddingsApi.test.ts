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

const articleSchema = {
  name: 'Article',
  fields: { title: { type: TYPE.String }, body: { type: TYPE.String } },
  modelOptions: { conduit: { authorization: { enabled: true } } },
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
};

const moduleConfig = {
  enabled: true,
  defaultProvider: 'openai-compatible',
  providers: {
    'openai-compatible': {
      endpoint: 'https://api.openai.com/v1/embeddings',
      apiKey: 'sk-test',
      allowedHosts: ['api.openai.com'],
    },
  },
  queue: { concurrency: 1, attempts: 3, maxBatchSize: 50 },
  security: {
    requireGrpcKey: false,
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
  }>;
  schemas?: Record<string, SchemaInfo>;
  declared?: Record<string, { name: string; ownerModule: string }>;
  embed?: EmbeddingsApiDeps['embed'];
  vectorSearch?: EmbeddingsApiDeps['vectorSearch'];
  enqueue?: string[];
  config?: Config;
  queue?: { generation: QueueJobCounts; backfill: QueueJobCounts };
}) {
  const configs = [...(overrides?.configs ?? [])];
  const runs = [...(overrides?.runs ?? [])];
  const enqueued = overrides?.enqueue ?? [];
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
    setSchemaExtension: async () => undefined,
    getVectorCapabilities: async () => overrides?.capabilities ?? readyCapabilities,
    getVectorIndexes: async () => overrides?.indexes ?? [readyIndex],
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
    embed:
      overrides?.embed ??
      (async () => Array.from({ length: 3 }, (_, index) => index + 0.1)),
  };
  return { api: new EmbeddingsApi(deps), configs, runs, enqueued };
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
  it('upserts a typed config and refuses to enable without a queryable index', async () => {
    const { api, configs } = createApi({ indexes: [] });
    await assert.rejects(
      () =>
        api.upsertConfig(
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
        ),
      (err: unknown) =>
        err instanceof GrpcError && err.code === status.FAILED_PRECONDITION,
    );
    const saved = await api.upsertConfig(
      {
        schemaName: 'Article',
        sourceFields: ['title'],
        targetField: 'embedding',
        provider: 'openai-compatible',
        model: 'text-embedding-3-small',
        dimensions: 3,
        enabled: false,
      },
      { callerModule: 'database' },
    );
    assert.equal(saved.config.enabled, false);
    assert.equal(saved.config.model, 'text-embedding-3-small');
    assert.equal(typeof saved.config.id, 'string');
    assert.equal(
      saved.warnings.some(warning => /not queryable/.test(warning)),
      true,
    );
    assert.equal(configs.length, 1);
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
            model: 'm',
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
    const { api } = createApi({
      configs: [enabledConfig],
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
    assert.equal(result.hits.length, 1);
    assert.equal(JSON.parse(result.hits[0].document)._id, 'doc1');
    assert.equal(result.hits[0].score, 0.91);
    const mapped = api.mapGrpcError(
      new GrpcError(status.FAILED_PRECONDITION, 'index not ready'),
    );
    assert.equal(mapped.code, status.FAILED_PRECONDITION);
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
});
