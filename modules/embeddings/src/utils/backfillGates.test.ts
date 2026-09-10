import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk, VectorIndexStatus } from '@conduitplatform/grpc-sdk';
import {
  assertBackfillExecutable,
  BackfillGateError,
  findTargetVectorIndex,
  grpcErrorFromBackfillGate,
  isEmbeddingVectorIndexQueryable,
} from './backfillGates.js';

const capabilities = {
  supported: true,
  storage: true,
  provider: 'mongodb' as const,
};

const config = {
  _id: 'cfg1',
  enabled: true,
  schemaName: 'Article',
  targetField: 'embedding',
  dimensions: 3,
  similarity: 'cosine',
};

const readyIndex = {
  field: 'embedding',
  name: 'embedding_vector',
  status: VectorIndexStatus.Ready,
  queryable: true,
  dimensions: 3,
  similarity: 'cosine',
};

describe('backfill execution gates', () => {
  it('blocks disabled modules, unsupported storage, and disabled configs', () => {
    assert.throws(
      () =>
        assertBackfillExecutable({
          moduleEnabled: false,
          capabilities,
          config,
          indexes: [readyIndex],
        }),
      (err: unknown) =>
        err instanceof BackfillGateError && err.reason === 'module_disabled',
    );
    assert.throws(
      () =>
        assertBackfillExecutable({
          moduleEnabled: true,
          capabilities: {
            supported: false,
            storage: false,
            provider: 'unsupported',
            reason: 'mysql does not support Conduit vector search',
          },
          config,
          indexes: [readyIndex],
        }),
      (err: unknown) =>
        err instanceof BackfillGateError &&
        err.reason === 'vector_unsupported' &&
        /mysql/.test(err.message),
    );
    assert.throws(
      () =>
        assertBackfillExecutable({
          moduleEnabled: true,
          capabilities: {
            supported: true,
            storage: false,
            provider: 'postgres',
            reason: 'pgvector is not available',
          },
          config,
          indexes: [readyIndex],
        }),
      (err: unknown) =>
        err instanceof BackfillGateError && err.reason === 'vector_storage_unavailable',
    );
    assert.throws(
      () =>
        assertBackfillExecutable({
          moduleEnabled: true,
          capabilities,
          config: { ...config, enabled: false },
          indexes: [readyIndex],
        }),
      (err: unknown) =>
        err instanceof BackfillGateError && err.reason === 'config_disabled',
    );
    assert.throws(
      () =>
        assertBackfillExecutable({
          moduleEnabled: true,
          capabilities,
          config: null,
          indexes: [readyIndex],
        }),
      (err: unknown) =>
        err instanceof BackfillGateError && err.reason === 'config_not_found',
    );
  });

  it('requires a queryable vector index and keeps the status actionable', () => {
    assert.equal(isEmbeddingVectorIndexQueryable(readyIndex), true);
    assert.equal(
      isEmbeddingVectorIndexQueryable({
        field: 'embedding',
        name: 'embedding_vector',
      }),
      false,
    );
    assert.equal(
      isEmbeddingVectorIndexQueryable({
        field: 'embedding',
        status: VectorIndexStatus.Pending,
      }),
      false,
    );
    assert.deepEqual(findTargetVectorIndex([readyIndex], 'embedding'), readyIndex);
    assert.equal(
      findTargetVectorIndex(
        [
          readyIndex,
          {
            field: 'embedding',
            name: 'embedding_vector_v2',
            status: VectorIndexStatus.Pending,
            queryable: false,
          },
        ],
        'embedding',
      )?.name,
      'embedding_vector_v2',
    );
    assert.equal(
      findTargetVectorIndex([readyIndex], 'embedding', {
        dimensions: 3,
        similarity: 'euclidean',
      }),
      undefined,
    );
    assert.equal(
      findTargetVectorIndex(
        [
          readyIndex,
          {
            field: 'embedding',
            name: 'embedding_vector_v2',
            status: VectorIndexStatus.Pending,
            queryable: false,
            dimensions: 3,
            similarity: 'euclidean',
          },
        ],
        'embedding',
        { dimensions: 3, similarity: 'euclidean' },
      )?.name,
      'embedding_vector_v2',
    );
    assert.throws(
      () =>
        assertBackfillExecutable({
          moduleEnabled: true,
          capabilities,
          config: { ...config, similarity: 'euclidean' },
          indexes: [readyIndex],
        }),
      (err: unknown) =>
        err instanceof BackfillGateError &&
        err.reason === 'index_not_queryable' &&
        err.indexStatus === 'missing',
    );
    assert.throws(
      () =>
        assertBackfillExecutable({
          moduleEnabled: true,
          capabilities,
          config,
          indexes: [
            {
              field: 'embedding',
              name: 'embedding_vector',
              status: VectorIndexStatus.Pending,
              queryable: false,
              dimensions: 3,
              similarity: 'cosine',
            },
          ],
        }),
      (err: unknown) =>
        err instanceof BackfillGateError &&
        err.reason === 'index_not_queryable' &&
        err.indexStatus === VectorIndexStatus.Pending &&
        /Wait until the index is ready/.test(err.message),
    );
    assert.doesNotThrow(() =>
      assertBackfillExecutable({
        moduleEnabled: true,
        capabilities,
        config,
        indexes: [{ ...readyIndex, method: '' }],
      }),
    );
    const mapped = grpcErrorFromBackfillGate(
      new BackfillGateError(
        'index_not_queryable',
        "Vector index for field 'embedding' is not queryable (status: pending). Wait until the index is ready before running a backfill.",
        'pending',
      ),
    );
    assert.equal(mapped.code, 9);
  });
});

describe('embedding metric increments do not accept labels', () => {
  it('increments named counters without attaching payload data', async () => {
    const { incrementEmbeddingMetric, EMBEDDING_METRICS } =
      await import('./embeddingMetrics.js');
    const seen: Array<{ name: string; amount?: number; labels?: unknown }> = [];
    const previous = ConduitGrpcSdk.Metrics;
    ConduitGrpcSdk.Metrics = {
      increment(name: string, amount?: number, labels?: unknown) {
        seen.push({ name, amount, labels });
      },
    } as never;
    try {
      incrementEmbeddingMetric('generated', 2);
      incrementEmbeddingMetric('failed');
      incrementEmbeddingMetric('skipped', 1);
      incrementEmbeddingMetric('retried', 1);
      incrementEmbeddingMetric('backfill', 3);
      incrementEmbeddingMetric('malformedEvents');
      incrementEmbeddingMetric('malformedJobs');
      incrementEmbeddingMetric('storageExtracted');
      incrementEmbeddingMetric('storageSkipped');
      incrementEmbeddingMetric('storageFailed');
      incrementEmbeddingMetric('generated', 0);
    } finally {
      ConduitGrpcSdk.Metrics = previous;
    }
    assert.deepEqual(
      seen.map(item => item.name),
      [
        EMBEDDING_METRICS.generated,
        EMBEDDING_METRICS.failed,
        EMBEDDING_METRICS.skipped,
        EMBEDDING_METRICS.retried,
        EMBEDDING_METRICS.backfill,
        EMBEDDING_METRICS.malformedEvents,
        EMBEDDING_METRICS.malformedJobs,
        EMBEDDING_METRICS.storageExtracted,
        EMBEDDING_METRICS.storageSkipped,
        EMBEDDING_METRICS.storageFailed,
      ],
    );
    assert.equal(
      seen.every(item => item.labels === undefined),
      true,
    );
    assert.equal(
      seen.some(
        item =>
          JSON.stringify(item).includes('sk-') || JSON.stringify(item).includes('doc'),
      ),
      false,
    );
  });
});
