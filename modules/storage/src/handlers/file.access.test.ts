import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { ConfigController } from '@conduitplatform/module-tools';
import { File, _StorageContainer, _StorageFolder } from '../models/index.js';
import { FileHandlers } from './file.js';

const originalFileGetInstance = File.getInstance.bind(File);
const originalContainerGetInstance =
  _StorageContainer.getInstance.bind(_StorageContainer);
const originalFolderGetInstance = _StorageFolder.getInstance.bind(_StorageFolder);

afterEach(() => {
  File.getInstance = originalFileGetInstance;
  _StorageContainer.getInstance = originalContainerGetInstance;
  _StorageFolder.getInstance = originalFolderGetInstance;
});

function stubModels() {
  File.getInstance = (() => ({})) as unknown as typeof File.getInstance;
  _StorageContainer.getInstance =
    (() => ({})) as unknown as typeof _StorageContainer.getInstance;
  _StorageFolder.getInstance =
    (() => ({})) as unknown as typeof _StorageFolder.getInstance;
}

describe('FileHandlers.fileAccessCheck', () => {
  it('authorizes module-to-module reads by partition scope instead of a user', async () => {
    stubModels();
    const checked: Array<Record<string, unknown>> = [];
    const handlers = new FileHandlers(
      {
        databaseProvider: {},
        authorization: {
          can: async (input: Record<string, unknown>) => {
            checked.push(input);
            return { allow: input.subject === 'Team:tenant-a' };
          },
        },
      } as never,
      {} as never,
    );
    ConfigController.getInstance().config = { authorization: { enabled: true } };
    await handlers.fileAccessCheck(
      'read',
      { context: {}, queryParams: { scope: 'Team:tenant-a' } },
      { _id: 'file-1' } as never,
    );
    await assert.rejects(
      () =>
        handlers.fileAccessCheck(
          'read',
          { context: {}, queryParams: { scope: 'Team:tenant-b' } },
          { _id: 'file-1' } as never,
        ),
      (err: unknown) => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
    assert.deepEqual(checked, [
      { subject: 'Team:tenant-a', actions: ['read'], resource: 'File:file-1' },
      { subject: 'Team:tenant-b', actions: ['read'], resource: 'File:file-1' },
    ]);
  });
});
