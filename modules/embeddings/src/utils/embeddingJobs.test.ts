import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeEmbeddingJobs,
  embeddingJobId,
  isDuplicateJobError,
  parseEmbeddingJobData,
  parseEmbeddingJobBatch,
} from './embeddingJobs.js';

describe('embedding job identity', () => {
  it('deduplicates jobs by schema, document, and config identity', () => {
    const jobs = dedupeEmbeddingJobs([
      { schemaName: 'Article', documentId: 'a' },
      { schemaName: 'Article', documentId: 'a' },
      { schemaName: 'Article', documentId: 'a', configId: 'c1' },
      { schemaName: 'Article', documentId: 'b', configId: 'c1' },
      { schemaName: 'Article', documentId: 'a', configId: 'c1' },
    ]);
    assert.deepEqual(
      jobs.map(job => embeddingJobId(job)),
      ['Article__a', 'Article__a__c1', 'Article__b__c1'],
    );
  });

  it('detects BullMQ duplicate job errors', () => {
    assert.equal(isDuplicateJobError(new Error('Job Article__a already exists')), true);
    assert.equal(isDuplicateJobError(new Error('redis timeout')), false);
  });

  it('rejects malformed and oversized queue payloads', () => {
    assert.equal(
      parseEmbeddingJobData({ schemaName: 'Article', documentId: 'a' }).ok,
      true,
    );
    assert.equal(parseEmbeddingJobData({ schemaName: 'Article' }).ok, false);
    assert.equal(
      parseEmbeddingJobData({ schemaName: '../etc', documentId: 'a' }).ok,
      false,
    );
    assert.equal(
      parseEmbeddingJobData({
        schemaName: 'Article',
        documentId: 'a',
        configId: 'c1',
        backfillRunId: 'run1',
      }).ok,
      true,
    );
    assert.equal(
      parseEmbeddingJobData({ schemaName: 'Article', documentId: 'a', extra: true }).ok,
      false,
    );
    assert.equal(
      parseEmbeddingJobBatch(
        new Array(600).fill({ schemaName: 'Article', documentId: 'a' }),
      ).length,
      500,
    );
  });
});
