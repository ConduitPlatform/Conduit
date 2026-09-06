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
        allowedHosts: [],
      }),
    ];
    assert.equal(
      warnings.some(warning => /mysql is storage-only/.test(warning)),
      true,
    );
    assert.equal(
      warnings.some(warning => /allowlist is empty/.test(warning)),
      true,
    );
    assert.equal(warnings.join(' ').includes('sk-secret'), false);
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
