import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { File, _StorageContainer } from '../models/index.js';
import { IStorageProvider } from '../interfaces/index.js';
import { _createFileUploadUrl, _updateFile, storeNewFile } from './index.js';
import { FILE_LIFECYCLE_EVENTS } from './fileEvents.js';
import { FILE_UPLOAD_STATUS, PENDING_UPLOAD_PLACEHOLDER } from './fileUploadState.js';

const originalFileGetInstance = File.getInstance.bind(File);
const originalContainerGetInstance =
  _StorageContainer.getInstance.bind(_StorageContainer);

afterEach(() => {
  File.getInstance = originalFileGetInstance;
  _StorageContainer.getInstance = originalContainerGetInstance;
});

function stubContainers() {
  _StorageContainer.getInstance = (() => ({
    findOne: async () => ({ name: 'docs', isPublic: false }),
    findMany: async () => [{ name: 'docs', isPublic: false }],
  })) as unknown as typeof _StorageContainer.getInstance;
}

function stubFileStore() {
  const store: Array<Record<string, unknown>> = [];
  File.getInstance = (() => ({
    create: async (doc: Record<string, unknown>) => {
      const created = { _id: `file-${store.length + 1}`, ...doc };
      store.push(created);
      return created;
    },
    findByIdAndUpdate: async (id: string, update: Record<string, unknown>) => {
      const found = store.find(doc => doc._id === id);
      if (!found) return null;
      Object.assign(found, update);
      return found;
    },
  })) as unknown as typeof File.getInstance;
  return store;
}

function mockProvider(statImpl: IStorageProvider['stat']): IStorageProvider & {
  stored: Array<{ fileName: string; data: Buffer }>;
} {
  const stored: Array<{ fileName: string; data: Buffer }> = [];
  const provider = {
    stored,
    container: () => provider,
    store: async (fileName: string, data: Buffer) => {
      stored.push({ fileName, data: Buffer.from(data) });
      return true;
    },
    stat: statImpl,
    getUploadUrl: async () => 'https://upload.example/put',
    getPublicUrl: async () => new Error('private'),
    delete: async () => true,
  };
  return provider as unknown as IStorageProvider & {
    stored: Array<{ fileName: string; data: Buffer }>;
  };
}

describe('storeNewFile', () => {
  it('marks a direct upload ready only after bytes persist and emits ready', async () => {
    stubContainers();
    const files = stubFileStore();
    const published: Array<{ channel: string; message: string }> = [];
    const provider = mockProvider(async () => ({
      exists: true,
      size: 5,
      etag: '"direct-1"',
    }));

    const file = await storeNewFile(
      provider,
      {
        name: 'hello.txt',
        data: Buffer.from('hello').toString('base64'),
        container: 'docs',
        folder: '/',
        mimeType: 'text/plain',
      },
      {
        bus: {
          publish: (channel: string, message: string) =>
            published.push({ channel, message }),
        },
      } as unknown as ConduitGrpcSdk,
    );

    assert.equal(provider.stored.length, 1);
    assert.equal(provider.stored[0].data.toString(), 'hello');
    assert.equal(file.uploadStatus, FILE_UPLOAD_STATUS.ready);
    assert.equal(files[0].uploadStatus, FILE_UPLOAD_STATUS.ready);
    assert.equal(file.contentVersion, 'direct-1');
    assert.equal(published[0].channel, FILE_LIFECYCLE_EVENTS.ready);
  });
});

describe('_createFileUploadUrl', () => {
  it('persists a pending placeholder and never emits ready', async () => {
    stubContainers();
    stubFileStore();
    const provider = mockProvider(async () => ({
      exists: true,
      size: Buffer.byteLength(PENDING_UPLOAD_PLACEHOLDER),
      etag: 'placeholder',
    }));

    const { file, url } = await _createFileUploadUrl(provider, {
      name: 'soon.txt',
      container: 'docs',
      folder: '/',
      mimeType: 'text/plain',
      size: 0,
    });

    assert.equal(url, 'https://upload.example/put');
    assert.equal(file.uploadStatus, FILE_UPLOAD_STATUS.pending);
    assert.equal(file.etag, 'placeholder');
    assert.equal(provider.stored[0].data.toString(), PENDING_UPLOAD_PLACEHOLDER);
  });
});

describe('_updateFile', () => {
  it('persists replacement bytes then emits update with a new content version', async () => {
    stubContainers();
    const files = stubFileStore();
    files.push({
      _id: 'file-1',
      name: 'hello.txt',
      folder: '/',
      container: 'docs',
      size: 5,
      isPublic: false,
      mimeType: 'text/plain',
      uploadStatus: FILE_UPLOAD_STATUS.ready,
      contentVersion: 'old',
    });
    const published: string[] = [];
    const provider = mockProvider(async () => ({
      exists: true,
      size: 7,
      etag: 'updated-1',
    }));
    const file = await _updateFile(
      provider,
      files[0] as never,
      {
        name: 'hello.txt',
        data: Buffer.from('updated'),
        container: 'docs',
        folder: '/',
        mimeType: 'text/plain',
      },
      {
        bus: { publish: (channel: string) => published.push(channel) },
      } as unknown as ConduitGrpcSdk,
    );

    assert.equal(file.uploadStatus, FILE_UPLOAD_STATUS.ready);
    assert.equal(file.size, 7);
    assert.equal(file.contentVersion, 'updated-1');
    assert.deepEqual(published, [FILE_LIFECYCLE_EVENTS.update]);
  });
});
