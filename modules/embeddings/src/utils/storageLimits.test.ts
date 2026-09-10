import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  DEFAULT_STORAGE_EXTRACTION_LIMITS,
  storageExtractionLimits,
  validateOperationalLimits,
} from './storageLimits.js';
import type { Config } from '../config/index.js';

describe('storage extraction and operational limits', () => {
  it('applies documented defaults and caps chunks by the ingest security limit', () => {
    assert.deepEqual(storageExtractionLimits(), DEFAULT_STORAGE_EXTRACTION_LIMITS);
    const capped = storageExtractionLimits({
      security: { maxChunksPerDocument: 8, maxChunkTextBytes: 512 },
      storageExtraction: { maxChunksPerFile: 256, chunkOverlapBytes: 0 },
    } as Config);
    assert.equal(capped.maxChunksPerFile, 8);
    assert.equal(capped.maxChunkBytes, 512);
    assert.equal(capped.chunkOverlapBytes, 0);
  });

  it('rejects zero, negative, and non-integer extraction, queue, and security limits', () => {
    assert.throws(
      () =>
        validateOperationalLimits({
          storageExtraction: { maxFileBytes: 0 },
        }),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        /storageExtraction.maxFileBytes/.test(err.message),
    );
    assert.throws(
      () =>
        validateOperationalLimits({
          queue: { concurrency: 1.5 },
        }),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () =>
        validateOperationalLimits({
          security: { maxIngestBatchSize: -1 },
        }),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () =>
        validateOperationalLimits({
          storageExtraction: { chunkOverlapBytes: -1 },
        }),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    assert.throws(
      () =>
        validateOperationalLimits({
          security: { trustedIngestModules: ['chat!'] },
        }),
      (err: unknown) =>
        err instanceof GrpcError &&
        err.code === status.INVALID_ARGUMENT &&
        /trustedIngestModules/.test(err.message),
    );
    assert.doesNotThrow(() =>
      validateOperationalLimits({
        queue: { concurrency: 2, attempts: 3, maxBatchSize: 500, drainTimeoutMs: 1000 },
        security: {
          trustedIngestModules: ['database', 'core', 'storage', 'embeddings'],
          maxIngestBatchSize: 100,
        },
        storageExtraction: {
          maxFileBytes: 1024,
          chunkOverlapBytes: 0,
          queueConcurrency: 1,
          queueAttempts: 5,
        },
      }),
    );
  });
});
