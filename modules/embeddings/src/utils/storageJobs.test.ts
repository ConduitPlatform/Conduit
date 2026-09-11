import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isBullMqCompatibleJobId } from './queueJobId.js';
import {
  dedupeStorageIngestJobs,
  parseStorageIngestJob,
  storageIngestJobId,
  storageJobDocumentKey,
  type StorageIngestJobData,
} from './storageJobs.js';

const FILE_UUID = '550e8400-e29b-41d4-a716-446655440000';
const LONG_VERSION = `${'v'.repeat(200)}/${'🙂'.repeat(50)}:${'/'.repeat(80)}`;

function ingest(overrides?: Partial<StorageIngestJobData>): StorageIngestJobData {
  return {
    kind: 'ingest',
    sourceId: 'src1',
    fileId: 'file1',
    contentVersion: 'v1',
    ...overrides,
  };
}

describe('storage ingest jobs', () => {
  it('builds BullMQ-safe hashed ids for opaque versions and actions', () => {
    const uuidIngest = storageIngestJobId(
      ingest({ fileId: FILE_UUID, contentVersion: 'v1' }),
    );
    const messyIngest = storageIngestJobId(
      ingest({
        fileId: FILE_UUID,
        contentVersion: 'etag:sha256/abc:def',
      }),
    );
    const unicodeIngest = storageIngestJobId(
      ingest({ fileId: FILE_UUID, contentVersion: LONG_VERSION }),
    );
    const deleteSameFile = storageIngestJobId({
      kind: 'delete',
      sourceId: 'src1',
      fileId: FILE_UUID,
    });
    const folder = storageIngestJobId({
      kind: 'deleteFolder',
      sourceId: 'src1',
      container: 'docs',
      folder: 'inbox/team:a/',
    });
    const reconcile = storageIngestJobId({
      kind: 'reconcile',
      sourceId: 'src1',
      cursor: FILE_UUID,
    });
    for (const id of [
      uuidIngest,
      messyIngest,
      unicodeIngest,
      deleteSameFile,
      folder,
      reconcile,
    ]) {
      assert.equal(isBullMqCompatibleJobId(id), true);
      assert.match(id, /^(ingest|delete|deletefolder|reconcile)_[0-9a-f]{64}$/);
    }
    assert.notEqual(uuidIngest, messyIngest);
    assert.notEqual(uuidIngest, unicodeIngest);
    assert.notEqual(uuidIngest, deleteSameFile);
    assert.equal(
      storageIngestJobId(ingest({ fileId: FILE_UUID, contentVersion: LONG_VERSION })),
      unicodeIngest,
    );
    assert.doesNotMatch(uuidIngest, /^Article__/);
  });

  it('keys failed jobs by source and document without using the content version', () => {
    assert.equal(
      storageJobDocumentKey(ingest({ fileId: FILE_UUID, contentVersion: 'v1' })),
      storageJobDocumentKey(ingest({ fileId: FILE_UUID, contentVersion: 'v2' })),
    );
    assert.notEqual(
      storageJobDocumentKey(ingest({ fileId: FILE_UUID })),
      storageJobDocumentKey({
        kind: 'ingest',
        sourceId: 'src2',
        fileId: FILE_UUID,
      }),
    );
    assert.equal(
      storageJobDocumentKey({
        kind: 'delete',
        sourceId: 'src1',
        fileId: FILE_UUID,
      }),
      `src1:file:${FILE_UUID}`,
    );
  });

  it('dedupes duplicate events and keeps distinct versions, deletes, and file sets', () => {
    assert.equal(parseStorageIngestJob({ kind: 'ingest', sourceId: 'src1' }).ok, false);
    const parsed = parseStorageIngestJob({
      kind: 'ingest',
      sourceId: 'src1',
      fileId: FILE_UUID,
      contentVersion: 'v1',
      reason: 'ready',
    });
    assert.equal(parsed.ok, true);
    const unique = dedupeStorageIngestJobs([
      ingest({ fileId: FILE_UUID, contentVersion: 'v1' }),
      ingest({ fileId: FILE_UUID, contentVersion: 'v1' }),
      ingest({ fileId: FILE_UUID, contentVersion: 'v2' }),
      { kind: 'delete', sourceId: 'src1', fileId: FILE_UUID },
      {
        kind: 'deleteMany',
        sourceId: 'src1',
        fileIds: [FILE_UUID, 'file-b'],
      },
      {
        kind: 'deleteMany',
        sourceId: 'src1',
        fileIds: ['file-b', FILE_UUID],
      },
    ]);
    assert.equal(unique.length, 4);
    assert.equal(
      storageIngestJobId({
        kind: 'deleteMany',
        sourceId: 'src1',
        fileIds: [FILE_UUID, 'file-b'],
      }),
      storageIngestJobId({
        kind: 'deleteMany',
        sourceId: 'src1',
        fileIds: ['file-b', FILE_UUID],
      }),
    );
  });
});
