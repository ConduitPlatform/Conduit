import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { File } from '../models/index.js';
import {
  emitContainerDeleted,
  emitFileDelete,
  emitFileDeleteMany,
  emitFileReady,
  emitFolderDeleted,
  FILE_LIFECYCLE_EVENTS,
  MAX_FILE_DELETE_EVENT_IDS,
  toFileLifecyclePayload,
} from './fileEvents.js';

function busSpy() {
  const published: Array<{ channel: string; message: string }> = [];
  const grpcSdk = {
    bus: {
      publish: (channel: string, message: string) => {
        published.push({ channel, message });
      },
    },
  } as unknown as ConduitGrpcSdk;
  return { grpcSdk, published };
}

describe('file lifecycle events', () => {
  it('emits ready metadata without urls', () => {
    const { grpcSdk, published } = busSpy();
    emitFileReady(grpcSdk, {
      _id: 'file-1',
      name: 'doc.txt',
      container: 'docs',
      folder: 'inbox/',
      mimeType: 'text/plain',
      size: 12,
      isPublic: false,
      uploadStatus: 'ready',
      contentVersion: 'etag-1',
      url: 'https://presigned.example/secret',
      sourceUrl: 'https://s3.example/secret',
    } as unknown as File);

    assert.equal(published.length, 1);
    assert.equal(published[0].channel, FILE_LIFECYCLE_EVENTS.ready);
    const payload = JSON.parse(published[0].message);
    assert.deepEqual(payload, {
      id: 'file-1',
      name: 'doc.txt',
      container: 'docs',
      folder: 'inbox/',
      mimeType: 'text/plain',
      size: 12,
      isPublic: false,
      uploadStatus: 'ready',
      contentVersion: 'etag-1',
    });
    assert.equal('url' in payload, false);
    assert.equal('sourceUrl' in payload, false);
  });

  it('defaults missing uploadStatus to ready for legacy files', () => {
    const payload = toFileLifecyclePayload({
      _id: 'legacy-1',
      name: 'old.bin',
      size: 2,
    } as unknown as File);
    assert.equal(payload.uploadStatus, 'ready');
  });

  it('emits delete ids and chunks bulk deletes at the embeddings parser limit', () => {
    const { grpcSdk, published } = busSpy();
    emitFileDelete(grpcSdk, { _id: 'file-9', name: 'gone.txt' } as unknown as File);
    const ids = Array.from(
      { length: MAX_FILE_DELETE_EVENT_IDS + 3 },
      (_, i) => `id-${i}`,
    );
    emitFileDeleteMany(grpcSdk, ids, { container: 'docs', folder: 'inbox/' });
    emitFolderDeleted(grpcSdk, { id: 'folder-1', name: 'inbox/', container: 'docs' });
    emitContainerDeleted(grpcSdk, { id: 'c-1', name: 'docs' });

    assert.equal(published[0].channel, FILE_LIFECYCLE_EVENTS.delete);
    assert.equal(JSON.parse(published[0].message).id, 'file-9');
    const bulk = published.filter(
      item => item.channel === FILE_LIFECYCLE_EVENTS.deleteMany,
    );
    assert.equal(bulk.length, 2);
    assert.equal(JSON.parse(bulk[0].message).ids.length, MAX_FILE_DELETE_EVENT_IDS);
    assert.equal(JSON.parse(bulk[1].message).ids.length, 3);
    assert.equal(published.at(-2)?.channel, FILE_LIFECYCLE_EVENTS.deleteFolder);
    assert.equal(published.at(-1)?.channel, FILE_LIFECYCLE_EVENTS.deleteContainer);
  });
});
