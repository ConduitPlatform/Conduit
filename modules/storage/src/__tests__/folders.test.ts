import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '@grpc/grpc-js';
import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { _StorageContainer, _StorageFolder } from '../models/index.js';
import { assertNoPersonalFolderSquat, findOrCreateFolders } from '../authz/folders.js';

const originalConfig = ConfigController.getInstance().config;
const originalContainerGetInstance =
  _StorageContainer.getInstance.bind(_StorageContainer);
const originalFolderGetInstance = _StorageFolder.getInstance.bind(_StorageFolder);

afterEach(() => {
  ConfigController.getInstance().config = originalConfig;
  _StorageContainer.getInstance = originalContainerGetInstance;
  _StorageFolder.getInstance = originalFolderGetInstance;
});

describe('personal folder squat', () => {
  it('denies creating under another user personal root when it is missing', async () => {
    _StorageFolder.getInstance = (() => ({
      findOne: async () => null,
    })) as unknown as typeof _StorageFolder.getInstance;

    await assert.rejects(
      () => assertNoPersonalFolderSquat('cnd_other/', 'self', 'conduit'),
      (error: unknown) =>
        error instanceof GrpcError && error.code === status.PERMISSION_DENIED,
    );
    await assert.rejects(
      () => assertNoPersonalFolderSquat('cnd_other/sub/', 'self', 'conduit'),
      (error: unknown) =>
        error instanceof GrpcError && error.code === status.PERMISSION_DENIED,
    );
  });

  it('allows a user to create their own missing personal folder', async () => {
    _StorageFolder.getInstance = (() => ({
      findOne: async () => null,
    })) as unknown as typeof _StorageFolder.getInstance;
    await assertNoPersonalFolderSquat('cnd_self/', 'self', 'conduit');
  });

  it('allows a path under another personal root when that root already exists', async () => {
    _StorageFolder.getInstance = (() => ({
      findOne: async (query: { name?: string }) =>
        query.name === 'cnd_other/' ? { _id: 'dir1' } : null,
    })) as unknown as typeof _StorageFolder.getInstance;
    await assertNoPersonalFolderSquat('cnd_other/sub/', 'self', 'conduit');
  });
});

describe('findOrCreateFolders', () => {
  it('does not create a scope owner when admin omits scope', async () => {
    ConfigController.getInstance().config = {
      authorization: { enabled: true },
      defaultContainer: 'conduit',
    };
    const created: Array<{ subject: string; resource: string }> = [];
    const folders: Array<{ _id: string; name: string; container: string }> = [];
    _StorageContainer.getInstance = (() => ({
      findOne: async () => ({ _id: 'c1', name: 'conduit' }),
    })) as unknown as typeof _StorageContainer.getInstance;
    _StorageFolder.getInstance = (() => ({
      findOne: async (query: { name?: string }) =>
        folders.find(folder => folder.name === query.name) ?? null,
      create: async (doc: { name: string; container: string }) => {
        const createdDoc = { _id: `dir-${folders.length + 1}`, ...doc };
        folders.push(createdDoc);
        return createdDoc;
      },
    })) as unknown as typeof _StorageFolder.getInstance;

    const grpcSdk = {
      authorization: {
        createRelation: async (relation: { subject: string; resource: string }) => {
          created.push(relation);
        },
      },
    } as unknown as ConduitGrpcSdk;
    const storage = {
      container: () => ({
        folderExists: async () => false,
        createFolder: async () => true,
      }),
    };

    const result = await findOrCreateFolders(
      grpcSdk,
      storage as never,
      'docs/nested/',
      'conduit',
    );
    assert.equal(result.length, 2);
    assert.deepEqual(
      created.map(relation => relation.subject),
      ['Container:c1', 'Folder:dir-1'],
    );
    assert.equal(
      created.some(
        relation => relation.subject == null || relation.subject === 'undefined',
      ),
      false,
    );
  });
});
