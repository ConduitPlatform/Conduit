import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { File, _StorageContainer } from '../models/index.js';
import {
  FILE_URI_MIGRATION_BATCH_SIZE,
  filesNeedingUriMigrationQuery,
  migrateFileUriReferences,
} from './fileUriMigration.js';

const originalFileGetInstance = File.getInstance.bind(File);
const originalContainerGetInstance =
  _StorageContainer.getInstance.bind(_StorageContainer);

afterEach(() => {
  File.getInstance = originalFileGetInstance;
  _StorageContainer.getInstance = originalContainerGetInstance;
});

describe('filesNeedingUriMigrationQuery', () => {
  it('filters public files that are missing uri', () => {
    const query = filesNeedingUriMigrationQuery();
    assert.equal(query.isPublic, true);
    assert.deepEqual(query.$or, [
      { uri: { $exists: false } },
      { uri: null },
      { uri: '' },
    ]);
    assert.equal('_id' in query, false);
  });

  it('cursors by _id after the last processed document', () => {
    const query = filesNeedingUriMigrationQuery('file-199');
    assert.deepEqual(query._id, { $gt: 'file-199' });
  });
});

describe('migrateFileUriReferences', () => {
  it('updates files in batches and clears stale urls in private containers', async () => {
    const files = Array.from(
      { length: FILE_URI_MIGRATION_BATCH_SIZE + 3 },
      (_, index) => ({
        _id: `file-${String(index).padStart(3, '0')}`,
        container: index === 0 ? 'public-bucket' : 'private-bucket',
      }),
    );
    const findManyCalls: Array<{
      query: Record<string, unknown>;
      options: Record<string, unknown>;
    }> = [];
    const updates: Array<{ id: string; update: Record<string, string> }> = [];

    File.getInstance = (() => ({
      findMany: async (
        query: Record<string, unknown>,
        options: Record<string, unknown>,
      ) => {
        findManyCalls.push({ query, options });
        const afterId = (query._id as { $gt?: string } | undefined)?.$gt;
        const remaining = afterId ? files.filter(file => file._id > afterId) : files;
        return remaining.slice(0, options.limit as number);
      },
      findByIdAndUpdate: async (id: string, update: Record<string, string>) => {
        updates.push({ id, update });
        return { _id: id, ...update };
      },
    })) as unknown as typeof File.getInstance;

    _StorageContainer.getInstance = (() => ({
      findMany: async (_query: unknown, options: { limit?: number }) => {
        const docs = [
          { _id: 'c1', name: 'public-bucket', isPublic: true },
          { _id: 'c2', name: 'private-bucket', isPublic: false },
        ];
        return docs.slice(0, options.limit);
      },
    })) as unknown as typeof _StorageContainer.getInstance;

    await migrateFileUriReferences();

    assert.equal(findManyCalls.length, 2);
    assert.equal(findManyCalls[0].options.limit, FILE_URI_MIGRATION_BATCH_SIZE);
    assert.deepEqual(findManyCalls[1].query._id, {
      $gt: `file-${String(FILE_URI_MIGRATION_BATCH_SIZE - 1).padStart(3, '0')}`,
    });
    assert.equal(updates.length, files.length);
    assert.equal(updates[0].update.uri, '/storage/getFileUrl/file-000');
    assert.equal(updates[0].update.url, undefined);
    assert.equal(updates[1].update.url, '');
    assert.equal(updates[1].update.sourceUrl, '');
  });

  it('rethrows after a failed batch so the caller cannot mark the migration as ran', async () => {
    File.getInstance = (() => ({
      findMany: async () => [{ _id: 'file-1', container: 'private-bucket' }],
      findByIdAndUpdate: async () => {
        throw new Error('write failed');
      },
    })) as unknown as typeof File.getInstance;
    _StorageContainer.getInstance = (() => ({
      findMany: async () => [{ _id: 'c2', name: 'private-bucket', isPublic: false }],
    })) as unknown as typeof _StorageContainer.getInstance;

    await assert.rejects(() => migrateFileUriReferences(), /write failed/);
  });
});
