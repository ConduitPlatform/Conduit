import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigController } from '@conduitplatform/module-tools';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { _StorageContainer, _StorageFolder, File } from '../models/index.js';
import { folderPrefixRegex } from './helpers.js';
import { deleteContainerTree, deleteFolderTree } from './cascade.js';

const originalConfig = ConfigController.getInstance().config;
const originalFileGetInstance = File.getInstance.bind(File);
const originalFolderGetInstance = _StorageFolder.getInstance.bind(_StorageFolder);
const originalContainerGetInstance =
  _StorageContainer.getInstance.bind(_StorageContainer);

afterEach(() => {
  ConfigController.getInstance().config = originalConfig;
  File.getInstance = originalFileGetInstance;
  _StorageFolder.getInstance = originalFolderGetInstance;
  _StorageContainer.getInstance = originalContainerGetInstance;
});

describe('folder delete prefix', () => {
  it('escapes regex so foo.bar/ does not match fooXbar/', () => {
    const prefix = folderPrefixRegex('foo.bar/');
    const re = new RegExp(prefix.$regex);
    assert.equal(re.test('foo.bar/'), true);
    assert.equal(re.test('foo.bar/nested/'), true);
    assert.equal(re.test('fooXbar/'), false);
  });
});

describe('deleteFolderTree', () => {
  it('deletes relations for every nested folder and file, then the provider and DB once', async () => {
    ConfigController.getInstance().config = {
      authorization: { enabled: true },
      defaultContainer: 'conduit',
    };
    const deletedRelations: Array<{ subject?: string; resource?: string }> = [];
    const deletedFolders: object[] = [];
    const deletedFiles: object[] = [];
    let providerDeletes = 0;

    _StorageFolder.getInstance = (() => ({
      findMany: async (_query: object, options?: { skip?: number; limit?: number }) => {
        const all = [{ _id: 'dir1' }, { _id: 'dir2' }];
        return all.slice(
          options?.skip ?? 0,
          (options?.skip ?? 0) + (options?.limit ?? 100),
        );
      },
      deleteMany: async (query: object) => {
        deletedFolders.push(query);
      },
    })) as unknown as typeof _StorageFolder.getInstance;
    File.getInstance = (() => ({
      findMany: async (_query: object, options?: { skip?: number; limit?: number }) => {
        const all = [{ _id: 'file1' }, { _id: 'file2' }];
        return all.slice(
          options?.skip ?? 0,
          (options?.skip ?? 0) + (options?.limit ?? 100),
        );
      },
      deleteMany: async (query: object) => {
        deletedFiles.push(query);
      },
    })) as unknown as typeof File.getInstance;

    const grpcSdk = {
      authorization: {
        deleteAllRelations: async (query: { subject?: string; resource?: string }) => {
          deletedRelations.push(query);
        },
      },
    } as unknown as ConduitGrpcSdk;
    const storage = {
      container: () => ({
        deleteFolder: async () => {
          providerDeletes += 1;
          return true;
        },
      }),
    };

    await deleteFolderTree(
      grpcSdk,
      storage as never,
      { _id: 'dir1', name: 'docs/', container: 'conduit' } as never,
    );

    const resources = deletedRelations.map(item => item.resource).filter(Boolean);
    const subjects = deletedRelations.map(item => item.subject).filter(Boolean);
    assert.deepEqual(resources.sort(), [
      'File:file1',
      'File:file2',
      'Folder:dir1',
      'Folder:dir2',
    ]);
    assert.deepEqual(subjects.sort(), ['Folder:dir1', 'Folder:dir2']);
    assert.equal(providerDeletes, 1);
    assert.equal(deletedFolders.length, 1);
    assert.equal(deletedFiles.length, 1);
    assert.deepEqual(deletedFolders[0], {
      name: folderPrefixRegex('docs/'),
      container: 'conduit',
    });
  });
});

describe('deleteContainerTree', () => {
  it('pages file and folder ids and also clears Container relations', async () => {
    ConfigController.getInstance().config = {
      authorization: { enabled: true },
      defaultContainer: 'conduit',
    };
    const deletedRelations: Array<{ subject?: string; resource?: string }> = [];
    File.getInstance = (() => ({
      findMany: async (_query: object, options?: { skip?: number; limit?: number }) => {
        const all = Array.from({ length: 3 }, (_, i) => ({ _id: `file${i}` }));
        return all.slice(
          options?.skip ?? 0,
          (options?.skip ?? 0) + (options?.limit ?? 2),
        );
      },
      deleteMany: async () => undefined,
    })) as unknown as typeof File.getInstance;
    _StorageFolder.getInstance = (() => ({
      findMany: async () => [{ _id: 'dir1' }],
      deleteMany: async () => undefined,
    })) as unknown as typeof _StorageFolder.getInstance;
    _StorageContainer.getInstance = (() => ({
      deleteOne: async () => undefined,
    })) as unknown as typeof _StorageContainer.getInstance;

    const grpcSdk = {
      authorization: {
        deleteAllRelations: async (query: { subject?: string; resource?: string }) => {
          deletedRelations.push(query);
        },
      },
    } as unknown as ConduitGrpcSdk;
    const storage = {
      deleteContainer: async () => true,
    };

    await deleteContainerTree(
      grpcSdk,
      storage as never,
      { _id: 'c1', name: 'photos' } as never,
    );

    assert.equal(
      deletedRelations.some(item => item.resource === 'Container:c1'),
      true,
    );
    assert.equal(
      deletedRelations.some(item => item.subject === 'Container:c1'),
      true,
    );
    assert.equal(
      deletedRelations.filter(item => item.resource?.startsWith('File:')).length,
      3,
    );
  });
});
