import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '@grpc/grpc-js';
import { GrpcError, ParsedRouterRequest } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { File, _StorageContainer, _StorageFolder } from '../models/index.js';
import { FileHandlers } from './file.js';
import { FILE_UPLOAD_STATUS } from '../utils/fileUploadState.js';

const originalFileGetInstance = File.getInstance.bind(File);
const originalContainerGetInstance =
  _StorageContainer.getInstance.bind(_StorageContainer);
const originalFolderGetInstance = _StorageFolder.getInstance.bind(_StorageFolder);

afterEach(() => {
  File.getInstance = originalFileGetInstance;
  _StorageContainer.getInstance = originalContainerGetInstance;
  _StorageFolder.getInstance = originalFolderGetInstance;
});

function stubModels(file: Record<string, unknown>) {
  File.getInstance = (() => ({
    findOne: async () => file,
    findByIdAndUpdate: async (_id: string, update: Record<string, unknown>) => ({
      ...file,
      ...update,
    }),
  })) as unknown as typeof File.getInstance;
  _StorageContainer.getInstance = (() => ({
    findOne: async () => ({ name: 'docs', isPublic: false }),
    findMany: async () => [{ name: 'docs', isPublic: false }],
  })) as unknown as typeof _StorageContainer.getInstance;
  _StorageFolder.getInstance =
    (() => ({})) as unknown as typeof _StorageFolder.getInstance;
}

function request(userId?: string): ParsedRouterRequest {
  return {
    request: {
      params: { id: 'file-1' },
      queryParams: {},
      context: userId ? { user: { _id: userId } } : {},
    },
  } as unknown as ParsedRouterRequest;
}

describe('FileHandlers.completeFileUpload authorization', () => {
  it('denies unauthenticated client completion when authorization is enabled', async () => {
    ConfigController.getInstance().config = { authorization: { enabled: true } };
    stubModels({
      _id: 'file-1',
      name: 'notes.txt',
      folder: '/',
      container: 'docs',
      uploadStatus: FILE_UPLOAD_STATUS.pending,
    });
    const handlers = new FileHandlers(
      { databaseProvider: {} } as never,
      { container: () => ({}) } as never,
    );
    await assert.rejects(
      () => handlers.completeFileUpload(request()),
      (error: unknown) =>
        error instanceof GrpcError && error.code === status.PERMISSION_DENIED,
    );
  });

  it('denies completion when the user cannot edit the file', async () => {
    ConfigController.getInstance().config = { authorization: { enabled: true } };
    stubModels({
      _id: 'file-1',
      name: 'notes.txt',
      folder: '/',
      container: 'docs',
      uploadStatus: FILE_UPLOAD_STATUS.pending,
    });
    const handlers = new FileHandlers(
      {
        databaseProvider: {},
        authorization: { can: async () => ({ allow: false }) },
      } as never,
      { container: () => ({}) } as never,
    );
    await assert.rejects(
      () => handlers.completeFileUpload(request('user-1')),
      (error: unknown) =>
        error instanceof GrpcError &&
        error.code === status.PERMISSION_DENIED &&
        error.message === 'You do not have access to file',
    );
  });

  it('completes after an authorized edit check', async () => {
    ConfigController.getInstance().config = { authorization: { enabled: true } };
    stubModels({
      _id: 'file-1',
      name: 'notes.txt',
      folder: '/',
      container: 'docs',
      size: 0,
      mimeType: 'text/plain',
      uploadStatus: FILE_UPLOAD_STATUS.pending,
      etag: 'ph',
    });
    const handlers = new FileHandlers(
      {
        databaseProvider: {},
        authorization: { can: async () => ({ allow: true }) },
        bus: { publish: () => undefined },
      } as never,
      {
        container: () => ({
          stat: async () => ({ exists: true, size: 20, etag: 'ready-1' }),
          get: async () => Buffer.from('not-placeholder'),
        }),
      } as never,
    );
    const result = (await handlers.completeFileUpload(request('user-1'))) as {
      uploadStatus: string;
      contentVersion: string;
    };
    assert.equal(result.uploadStatus, FILE_UPLOAD_STATUS.ready);
    assert.equal(result.contentVersion, 'ready-1');
  });
});
