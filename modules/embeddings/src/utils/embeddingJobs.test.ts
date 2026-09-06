import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeEmbeddingJobs,
  embeddingJobId,
  isDuplicateJobError,
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
});
