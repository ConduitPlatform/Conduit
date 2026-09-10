import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '@grpc/grpc-js';
import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { File } from '../models/index.js';
import { IStorageProvider, ObjectStat } from '../interfaces/index.js';
import { collectAndDeleteFiles, completeFileUpload } from './fileLifecycle.js';
import { FILE_LIFECYCLE_EVENTS } from './fileEvents.js';
import { FILE_UPLOAD_STATUS, PENDING_UPLOAD_PLACEHOLDER } from './fileUploadState.js';

const originalGetInstance = File.getInstance.bind(File);

afterEach(() => {
  File.getInstance = originalGetInstance;
});

function mockProvider(options: {
  stat?: ObjectStat | Error;
  get?: Buffer | Error;
}): IStorageProvider {
  return {
    container: () => mockProvider(options),
    stat: async () => options.stat ?? { exists: false },
    get: async () => options.get ?? new Error('not implemented'),
  } as unknown as IStorageProvider;
}

function stubFiles(docs: object[]) {
  const store = docs.map(doc => ({ ...doc })) as Array<Record<string, unknown>>;
  File.getInstance = (() => ({
    findByIdAndUpdate: async (id: string, update: Record<string, unknown>) => {
      const found = store.find(doc => doc._id === id);
      if (!found) return null;
      Object.assign(found, update);
      return found;
    },
    findMany: async (query: Record<string, unknown>, opts?: { limit?: number }) => {
      let items = store;
      const clauses = (Array.isArray(query.$and) ? query.$and : [query]) as Array<
        Record<string, { $gt?: string } | string | undefined>
      >;
      for (const clause of clauses) {
        const afterId = (clause._id as { $gt?: string } | undefined)?.$gt;
        if (afterId) {
          items = items.filter(doc => String(doc._id) > afterId);
        }
        if (typeof clause.container === 'string') {
          items = items.filter(doc => doc.container === clause.container);
        }
        if (typeof clause.folder === 'string') {
          items = items.filter(doc => doc.folder === clause.folder);
        }
      }
      return items.slice(0, opts?.limit ?? items.length);
    },
    deleteMany: async () => {
      store.splice(0, store.length);
    },
  })) as unknown as typeof File.getInstance;
  return store;
}

describe('completeFileUpload', () => {
  it('marks a pending presigned upload ready after provider stat verification', async () => {
    const published: Array<{ channel: string; message: string }> = [];
    const store = stubFiles([
      {
        _id: 'file-1',
        name: 'notes.txt',
        folder: '/',
        container: 'docs',
        size: 0,
        mimeType: 'text/plain',
        uploadStatus: FILE_UPLOAD_STATUS.pending,
        etag: 'placeholder',
      },
    ]);
    const file = await completeFileUpload(
      mockProvider({
        stat: { exists: true, size: 21, etag: '"v2"', contentType: 'text/plain' },
      }),
      store[0] as unknown as File,
      {
        bus: {
          publish: (channel: string, message: string) =>
            published.push({ channel, message }),
        },
      } as unknown as ConduitGrpcSdk,
    );

    assert.equal(file.uploadStatus, FILE_UPLOAD_STATUS.ready);
    assert.equal(file.size, 21);
    assert.equal(file.contentVersion, 'v2');
    assert.equal(published[0].channel, FILE_LIFECYCLE_EVENTS.ready);
    assert.equal(JSON.parse(published[0].message).id, 'file-1');
  });

  it('fails when the object is missing or still the pending placeholder', async () => {
    const pending = {
      _id: 'file-2',
      name: 'notes.txt',
      folder: '/',
      container: 'docs',
      size: 0,
      uploadStatus: FILE_UPLOAD_STATUS.pending,
      etag: 'placeholder',
    } as unknown as File;
    stubFiles([pending]);

    await assert.rejects(
      () => completeFileUpload(mockProvider({ stat: { exists: false } }), pending),
      (error: unknown) =>
        error instanceof GrpcError &&
        error.code === status.FAILED_PRECONDITION &&
        error.message === 'Upload is not complete',
    );
    await assert.rejects(
      () =>
        completeFileUpload(
          mockProvider({
            stat: { exists: true, size: 14, etag: 'placeholder' },
            get: Buffer.from(PENDING_UPLOAD_PLACEHOLDER),
          }),
          pending,
        ),
      (error: unknown) =>
        error instanceof GrpcError && error.code === status.FAILED_PRECONDITION,
    );
    await assert.rejects(
      () => completeFileUpload(mockProvider({ stat: new Error('forbidden') }), pending),
      (error: unknown) =>
        error instanceof GrpcError && error.code === status.FAILED_PRECONDITION,
    );
  });

  it('emits update when completing a replacement of an already-ready file', async () => {
    const published: string[] = [];
    const store = stubFiles([
      {
        _id: 'file-3',
        name: 'notes.txt',
        folder: '/',
        container: 'docs',
        size: 10,
        uploadStatus: FILE_UPLOAD_STATUS.ready,
        contentVersion: 'old',
        etag: 'old',
      },
    ]);
    const file = await completeFileUpload(
      mockProvider({ stat: { exists: true, size: 30, etag: 'new' } }),
      store[0] as unknown as File,
      {
        bus: { publish: (channel: string) => published.push(channel) },
      } as unknown as ConduitGrpcSdk,
    );
    assert.equal(file.contentVersion, 'new');
    assert.deepEqual(published, [FILE_LIFECYCLE_EVENTS.update]);
  });

  it('is a no-op when a ready file already matches provider metadata', async () => {
    const published: string[] = [];
    const file = {
      _id: 'file-4',
      name: 'notes.txt',
      folder: '/',
      container: 'docs',
      size: 8,
      uploadStatus: FILE_UPLOAD_STATUS.ready,
      contentVersion: 'same',
      etag: 'same',
    } as unknown as File;
    stubFiles([file]);
    const result = await completeFileUpload(
      mockProvider({ stat: { exists: true, size: 8, etag: 'same' } }),
      file,
      {
        bus: { publish: (channel: string) => published.push(channel) },
      } as unknown as ConduitGrpcSdk,
    );
    assert.equal(result, file);
    assert.deepEqual(published, []);
  });
});

describe('collectAndDeleteFiles', () => {
  it('publishes file ids and a folder cleanup signal', async () => {
    const published: Array<{ channel: string; message: string }> = [];
    stubFiles([
      { _id: 'a', container: 'docs', folder: 'inbox/', size: 4 },
      { _id: 'b', container: 'docs', folder: 'inbox/', size: 6 },
    ]);
    const ids = await collectAndDeleteFiles(
      { container: 'docs', folder: 'inbox/' },
      {
        bus: {
          publish: (channel: string, message: string) =>
            published.push({ channel, message }),
        },
      } as unknown as ConduitGrpcSdk,
      { type: 'folder', id: 'folder-1', name: 'inbox/', container: 'docs' },
    );
    assert.deepEqual(ids, ['a', 'b']);
    assert.equal(published[0].channel, FILE_LIFECYCLE_EVENTS.deleteMany);
    assert.deepEqual(JSON.parse(published[0].message).ids, ['a', 'b']);
    assert.equal(published[1].channel, FILE_LIFECYCLE_EVENTS.deleteFolder);
    assert.equal(JSON.parse(published[1].message).id, 'folder-1');
  });

  it('still emits a container cleanup signal when no files remain', async () => {
    const published: Array<{ channel: string; message: string }> = [];
    stubFiles([]);
    const ids = await collectAndDeleteFiles(
      { container: 'docs' },
      {
        bus: {
          publish: (channel: string, message: string) =>
            published.push({ channel, message }),
        },
      } as unknown as ConduitGrpcSdk,
      { type: 'container', id: 'c-1', name: 'docs' },
    );
    assert.deepEqual(ids, []);
    assert.equal(published[0].channel, FILE_LIFECYCLE_EVENTS.deleteContainer);
    assert.equal(JSON.parse(published[0].message).name, 'docs');
  });
});
