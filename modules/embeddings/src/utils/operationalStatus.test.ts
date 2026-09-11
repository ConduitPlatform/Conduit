import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError, VectorIndexStatus } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  assertConfigActivation,
  assertSearchExecutable,
  capabilityWarnings,
  grpcErrorFromSearchGate,
  isEmbeddingsReady,
  providerReadinessWarnings,
  SearchGateError,
  sourceExtractionWarnings,
  storagePeerWarnings,
  storageQueueWarnings,
  configuredWorkloadWarnings,
  countEmbeddingWorkloads,
  isQueryableGenericSource,
} from './operationalStatus.js';
import { mapBackfillRun, mapEmbeddingConfig, parseSearchHits } from './protoMappers.js';

describe('embeddings operational warnings and search gates', () => {
  it('warns on unsupported capabilities and missing provider settings without leaking secrets', () => {
    const warnings = [
      ...capabilityWarnings({
        supported: false,
        storage: false,
        indexing: false,
        search: false,
        provider: 'unsupported',
        reason: 'mysql is storage-only',
      }),
      ...providerReadinessWarnings({
        endpoint: '',
        apiKey: 'sk-secret',
        models: [],
      }),
    ];
    assert.equal(
      warnings.some(warning => /mysql is storage-only/.test(warning)),
      true,
    );
    assert.equal(
      warnings.some(warning => /model catalogue is empty/.test(warning)),
      true,
    );
    assert.equal(warnings.join(' ').includes('sk-secret'), false);
    assert.deepEqual(
      providerReadinessWarnings({
        endpoint: 'https://api.openai.com/v1/embeddings',
        apiKey: 'sk-secret',
        models: [{ name: 'small', dimensions: 1536 }],
        defaultModel: 'missing',
      }),
      ["Provider default model 'missing' is not in the catalogue"],
    );
    assert.equal(
      isEmbeddingsReady({
        moduleEnabled: false,
        warnings: ['Embeddings module is disabled'],
      }),
      false,
    );
  });

  it('blocks semantic search when the vector index is not queryable', () => {
    assert.throws(
      () =>
        assertSearchExecutable({
          capabilities: {
            supported: true,
            search: true,
            provider: 'mongodb',
          },
          config: {
            _id: 'cfg1',
            enabled: true,
            targetField: 'embedding',
            dimensions: 3,
            similarity: 'cosine',
          },
          indexes: [
            {
              field: 'embedding',
              status: VectorIndexStatus.Pending,
              queryable: false,
              dimensions: 3,
              similarity: 'cosine',
            },
          ],
        }),
      (err: unknown) =>
        err instanceof SearchGateError && err.reason === 'index_not_queryable',
    );
    const mapped = grpcErrorFromSearchGate(
      new SearchGateError('index_not_queryable', 'index pending', 'pending'),
    );
    assert.equal(mapped.code, status.FAILED_PRECONDITION);
  });

  it('allows search when the live index method is empty or omitted', () => {
    assert.doesNotThrow(() =>
      assertSearchExecutable({
        capabilities: {
          supported: true,
          search: true,
          provider: 'mongodb',
        },
        config: {
          _id: 'cfg1',
          enabled: true,
          targetField: 'embedding',
          dimensions: 3,
          similarity: 'cosine',
        },
        indexes: [
          {
            field: 'embedding',
            name: 'embedding_vector',
            status: VectorIndexStatus.Ready,
            queryable: true,
            dimensions: 3,
            similarity: 'cosine',
          },
        ],
      }),
    );
    assert.doesNotThrow(() =>
      assertSearchExecutable({
        capabilities: {
          supported: true,
          search: true,
          provider: 'mongodb',
        },
        config: {
          _id: 'cfg1',
          enabled: true,
          targetField: 'embedding',
          dimensions: 3,
          similarity: 'cosine',
        },
        indexes: [
          {
            field: 'embedding',
            name: 'embedding_vector',
            status: VectorIndexStatus.Ready,
            queryable: true,
            dimensions: 3,
            similarity: 'cosine',
            method: '',
          },
        ],
      }),
    );
  });

  it('denies search and activation when a queryable live index does not match the config contract', () => {
    const mismatched = {
      field: 'embedding',
      name: 'embedding_vector',
      status: VectorIndexStatus.Ready,
      queryable: true,
      dimensions: 3,
      similarity: 'cosine',
    };
    const config = {
      _id: 'cfg1',
      enabled: true,
      schemaName: 'Article',
      targetField: 'embedding',
      dimensions: 3,
      similarity: 'euclidean',
    };
    assert.throws(
      () =>
        assertSearchExecutable({
          capabilities: {
            supported: true,
            search: true,
            provider: 'mongodb',
          },
          config,
          indexes: [mismatched],
        }),
      (err: unknown) =>
        err instanceof SearchGateError && err.reason === 'index_not_queryable',
    );
    assert.throws(
      () =>
        assertConfigActivation({
          moduleEnabled: true,
          capabilities: {
            supported: true,
            storage: true,
            provider: 'mongodb',
          },
          config,
          indexes: [mismatched],
        }),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.FAILED_PRECONDITION &&
        /not queryable/.test(err.message),
    );
  });
});

describe('storage extraction status warnings', () => {
  it('warns on idle Storage peers and failed extraction queues without leaking references', () => {
    assert.deepEqual(
      storagePeerWarnings({ moduleEnabled: true, storageAvailable: false }),
      ['Storage module is unavailable; conduit-storage extraction is idle'],
    );
    assert.deepEqual(
      storagePeerWarnings({ moduleEnabled: true, storageAvailable: true }),
      [],
    );
    const queueWarnings = storageQueueWarnings({
      waiting: 1,
      active: 0,
      completed: 0,
      failed: 2,
      delayed: 0,
      paused: 0,
    });
    assert.equal(
      queueWarnings.some(warning => /failed jobs/.test(warning)),
      true,
    );
    assert.equal(queueWarnings.join(' ').includes('file-'), false);
    const sourceWarnings = sourceExtractionWarnings({
      kind: 'conduit-storage',
      failedCount: 3,
      storageAvailable: false,
      extractionQueue: {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 1,
        delayed: 0,
        paused: 0,
      },
    });
    assert.equal(
      sourceWarnings.some(warning => /3 documents failed extraction/.test(warning)),
      true,
    );
    assert.equal(
      sourceWarnings.some(warning => /Extracted text is not retained/.test(warning)),
      true,
    );
    assert.deepEqual(sourceExtractionWarnings({ kind: 'external', failedCount: 4 }), []);
  });
});

describe('generic source operational readiness', () => {
  const queryableConfig = {
    _id: 'cfg1',
    enabled: true,
    schemaName: 'Article',
    targetField: 'embedding',
    dimensions: 3,
    similarity: 'cosine',
  };
  const queryableIndex = {
    field: 'embedding',
    status: VectorIndexStatus.Ready,
    queryable: true,
    dimensions: 3,
    similarity: 'cosine',
  };
  const pendingIndex = {
    field: 'embedding',
    status: VectorIndexStatus.Pending,
    queryable: false,
    dimensions: 3,
    similarity: 'cosine',
  };

  it('uses a truth table for configured workload readiness including empty state', () => {
    const cases: Array<{
      name: string;
      configs?: (typeof queryableConfig)[];
      indexes?: (typeof queryableIndex)[];
      sources?: Array<{ state: string; chunkIndexStatus?: string }>;
      warning?: RegExp | null;
    }> = [
      { name: 'no configured workload', warning: null },
      {
        name: 'disabled sources only',
        sources: [{ state: 'disabled', chunkIndexStatus: VectorIndexStatus.Ready }],
        warning: null,
      },
      {
        name: 'revoked sources only',
        sources: [{ state: 'revoked', chunkIndexStatus: VectorIndexStatus.Ready }],
        warning: null,
      },
      {
        name: 'ready queryable source',
        sources: [{ state: 'ready', chunkIndexStatus: VectorIndexStatus.Ready }],
        warning: null,
      },
      {
        name: 'ready source without index status',
        sources: [{ state: 'ready' }],
        warning: null,
      },
      {
        name: 'ready unqueryable source',
        sources: [{ state: 'ready', chunkIndexStatus: VectorIndexStatus.Pending }],
        warning: /ready generic source/,
      },
      {
        name: 'pending source',
        sources: [{ state: 'pending' }],
        warning: /pending/,
      },
      {
        name: 'failed source',
        sources: [{ state: 'failed' }],
        warning: /failed/,
      },
      {
        name: 'queryable schema config',
        configs: [queryableConfig],
        indexes: [queryableIndex],
        warning: null,
      },
      {
        name: 'unqueryable schema config',
        configs: [queryableConfig],
        indexes: [pendingIndex],
        warning: /not queryable/,
      },
      {
        name: 'unqueryable config with queryable source',
        configs: [queryableConfig],
        indexes: [pendingIndex],
        sources: [{ state: 'ready', chunkIndexStatus: VectorIndexStatus.Ready }],
        warning: null,
      },
    ];
    for (const item of cases) {
      const warnings = configuredWorkloadWarnings({
        enabledConfigs: item.configs ?? [],
        indexesForConfig: () => item.indexes ?? [],
        sources: item.sources ?? [],
      });
      if (item.warning) {
        assert.equal(
          warnings.some(warning => item.warning!.test(warning)),
          true,
          item.name,
        );
      } else {
        assert.deepEqual(warnings, [], item.name);
      }
    }
  });

  it('counts source states without treating disabled or revoked as queryable', () => {
    const counts = countEmbeddingWorkloads({
      configs: [{ enabled: true }, { enabled: false }],
      sources: [
        { state: 'ready', chunkIndexStatus: VectorIndexStatus.Ready },
        { state: 'ready', chunkIndexStatus: VectorIndexStatus.Pending },
        { state: 'pending' },
        { state: 'failed' },
        { state: 'disabled', chunkIndexStatus: VectorIndexStatus.Ready },
        { state: 'revoked', chunkIndexStatus: VectorIndexStatus.Ready },
      ],
    });
    assert.equal(counts.configCount, 2);
    assert.equal(counts.enabledConfigCount, 1);
    assert.equal(counts.sourceCount, 6);
    assert.equal(counts.readySourceCount, 2);
    assert.equal(counts.queryableSourceCount, 1);
    assert.equal(counts.pendingSourceCount, 1);
    assert.equal(counts.failedSourceCount, 1);
    assert.equal(counts.disabledSourceCount, 1);
    assert.equal(counts.revokedSourceCount, 1);
    assert.equal(
      isQueryableGenericSource({
        state: 'disabled',
        chunkIndexStatus: VectorIndexStatus.Ready,
      }),
      false,
    );
  });
});

describe('typed proto mappers', () => {
  it('maps persisted configs and backfills without JSON-string envelopes', () => {
    const config = mapEmbeddingConfig({
      _id: 'cfg1',
      schemaName: 'Article',
      sourceFields: ['title'],
      targetField: 'embedding',
      provider: 'openai-compatible',
      modelName: 'text-embedding-3-small',
      dimensions: 3,
      similarity: 'cosine',
      enabled: true,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    });
    assert.equal(config.model, 'text-embedding-3-small');
    assert.equal(config.createdAt, '2026-01-02T00:00:00.000Z');
    const run = mapBackfillRun({
      _id: 'run1',
      schemaName: 'Article',
      state: 'queued',
      batchSize: 10,
      onlyMissing: true,
      scannedCount: 0,
      queuedCount: 0,
      processedCount: 0,
      failedCount: 0,
      filter: { status: 'draft' },
    });
    assert.equal(run.onlyMissing, true);
    assert.equal(run.filter, '{"status":"draft"}');
    const hits = parseSearchHits<{ _id: string }>([
      { document: '{"_id":"doc1"}', score: 0.5, metric: 'cosine', provider: 'mongodb' },
    ]);
    assert.equal(hits[0].document._id, 'doc1');
    assert.equal(hits[0].score, 0.5);
  });
});
