import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeStorageIngestJobs,
  parseStorageIngestJob,
  storageIngestJobId,
} from './storageJobs.js';

describe('storage ingest jobs', () => {
  it('builds collision-safe ids distinct from schema generation jobs', () => {
    assert.equal(
      storageIngestJobId({
        kind: 'ingest',
        sourceId: 'src1',
        fileId: 'file1',
        contentVersion: 'v2',
      }),
      'storage-ingest:src1:file1:v2',
    );
    assert.equal(
      storageIngestJobId({
        kind: 'delete',
        sourceId: 'src1',
        fileId: 'file1',
      }),
      'storage-delete:src1:file1',
    );
    assert.equal(
      storageIngestJobId({
        kind: 'deleteFolder',
        sourceId: 'src1',
        container: 'docs',
        folder: 'inbox/',
      }),
      'storage-deletefolder:src1:docs:inbox/',
    );
    assert.doesNotMatch(
      storageIngestJobId({
        kind: 'reconcile',
        sourceId: 'src1',
      }),
      /^Article:/,
    );
  });

  it('parses required fields and dedupes identical identities', () => {
    assert.equal(parseStorageIngestJob({ kind: 'ingest', sourceId: 'src1' }).ok, false);
    const parsed = parseStorageIngestJob({
      kind: 'ingest',
      sourceId: 'src1',
      fileId: 'file1',
      contentVersion: 'v1',
      reason: 'ready',
    });
    assert.equal(parsed.ok, true);
    const unique = dedupeStorageIngestJobs([
      { kind: 'ingest', sourceId: 'src1', fileId: 'file1', contentVersion: 'v1' },
      { kind: 'ingest', sourceId: 'src1', fileId: 'file1', contentVersion: 'v1' },
      { kind: 'ingest', sourceId: 'src1', fileId: 'file1', contentVersion: 'v2' },
    ]);
    assert.equal(unique.length, 2);
  });
});
