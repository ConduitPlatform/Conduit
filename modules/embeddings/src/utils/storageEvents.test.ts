import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FILE_LIFECYCLE_EVENTS } from './storageEventNames.js';
import {
  MAX_STORAGE_DELETE_EVENT_IDS,
  parseStorageBusMessage,
  parseStorageContainerEvent,
  parseStorageDeleteManyEvent,
  parseStorageFileEvent,
  parseStorageFolderEvent,
} from './storageEvents.js';

describe('storage lifecycle event parsing', () => {
  it('accepts direct and presigned completion payloads without urls', () => {
    const direct = parseStorageFileEvent({
      id: 'file-1',
      name: 'note.txt',
      container: 'docs',
      folder: 'inbox/',
      mimeType: 'text/plain',
      size: 12,
      uploadStatus: 'ready',
      contentVersion: 'v1',
    });
    const presigned = parseStorageFileEvent({
      id: 'file-2',
      name: 'upload.bin',
      container: 'docs',
      folder: 'inbox/',
      mimeType: 'text/plain',
      uploadStatus: 'ready',
      contentVersion: 'presign-1',
    });
    assert.equal(direct?.id, 'file-1');
    assert.equal(presigned?.contentVersion, 'presign-1');
    assert.equal('url' in (direct ?? {}), false);
    assert.equal(FILE_LIFECYCLE_EVENTS.ready, 'storage:ready:File');
    assert.equal(FILE_LIFECYCLE_EVENTS.update, 'storage:update:File');
  });

  it('rejects oversized deleteMany batches and parses folder/container cleanup', () => {
    assert.equal(
      parseStorageDeleteManyEvent({
        ids: Array.from({ length: MAX_STORAGE_DELETE_EVENT_IDS + 1 }, (_, i) => `f${i}`),
      }),
      null,
    );
    const bulk = parseStorageDeleteManyEvent({
      ids: ['a', 'b'],
      container: 'docs',
      folder: 'inbox/',
    });
    assert.deepEqual(bulk?.ids, ['a', 'b']);
    assert.equal(
      parseStorageFolderEvent({ name: 'inbox/', container: 'docs' })?.name,
      'inbox/',
    );
    assert.equal(parseStorageContainerEvent({ name: 'docs' })?.container, 'docs');
    assert.equal(parseStorageBusMessage('{'), null);
    assert.deepEqual(parseStorageBusMessage('{"id":"file-1"}'), { id: 'file-1' });
  });
});
