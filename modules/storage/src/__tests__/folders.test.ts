import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '@grpc/grpc-js';
import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { _StorageContainer, _StorageFolder } from '../models/index.js';
import {
  assertFolderEditAccess,
  assertNoPersonalFolderSquat,
  findOrCreateFolders,
} from '../authz/folders.js';

const originalConfig = ConfigController.getInstance().config;
const originalContainerGetInstance =
  _StorageContainer.getInstance.bind(_StorageContainer);
const originalFolderGetInstance = _StorageFolder.getInstance.bind(_StorageFolder);

afterEach(() => {
  ConfigController.getInstance().config = originalConfig;
  _StorageContainer.getInstance = originalContainerGetInstance;
  _StorageFolder.getInstance = originalFolderGetInstance;
});

function enableAuthz() {
  ConfigController.getInstance().config = {
    authorization: { enabled: true },
    defaultContainer: 'conduit',
  };
}

function disableAuthz() {
  ConfigController.getInstance().config = {
    authorization: { enabled: false },
    defaultContainer: 'conduit',
  };
}

function fakeSdk(args?: {
  managed?: string[];
  findRelationError?: Error;
  created?: Array<{ subject: string; relation: string; resource: string }>;
}) {
  const created = args?.created ?? [];
  const managed = new Set(args?.managed ?? []);
  return {
    grpcSdk: {
      authorization: {
        findRelation: async ({ resource }: { resource: string }) => {
          if (args?.findRelationError) {
            throw args.findRelationError;
          }
          const relations = managed.has(resource)
            ? [{ subject: 'User:owner', relation: 'owner', resource }]
            : [];
          return { relations, count: relations.length };
        },
        createRelation: async (relation: {
          subject: string;
          relation: string;
          resource: string;
        }) => {
          created.push(relation);
        },
        can: async ({ subject, resource }: { subject: string; resource: string }) => ({
          allow: managed.has(resource) && subject === 'User:owner',
        }),
      },
    } as unknown as ConduitGrpcSdk,
    created,
  };
}

describe('personal folder squat', () => {
  it('denies creating under another user personal root when it is missing', async () => {
    disableAuthz();
    _StorageFolder.getInstance = (() => ({
      findOne: async () => null,
    })) as unknown as typeof _StorageFolder.getInstance;
    const { grpcSdk } = fakeSdk();

    await assert.rejects(
      () => assertNoPersonalFolderSquat(grpcSdk, 'cnd_other/', 'self', 'conduit'),
      (error: unknown) =>
        error instanceof GrpcError && error.code === status.PERMISSION_DENIED,
    );
    await assert.rejects(
      () => assertNoPersonalFolderSquat(grpcSdk, 'cnd_other/sub/', 'self', 'conduit'),
      (error: unknown) =>
        error instanceof GrpcError && error.code === status.PERMISSION_DENIED,
    );
  });

  it('allows a user to create their own missing personal folder', async () => {
    disableAuthz();
    _StorageFolder.getInstance = (() => ({
      findOne: async () => null,
    })) as unknown as typeof _StorageFolder.getInstance;
    const { grpcSdk } = fakeSdk();
    await assertNoPersonalFolderSquat(grpcSdk, 'cnd_self/', 'self', 'conduit');
  });

  it('allows a path under another personal root when authz is off and that root exists', async () => {
    disableAuthz();
    _StorageFolder.getInstance = (() => ({
      findOne: async (query: { name?: string }) =>
        query.name === 'cnd_other/' ? { _id: 'dir1' } : null,
    })) as unknown as typeof _StorageFolder.getInstance;
    const { grpcSdk } = fakeSdk();
    await assertNoPersonalFolderSquat(grpcSdk, 'cnd_other/sub/', 'self', 'conduit');
  });

  it('denies an existing unmanaged personal root of another user when authz is on', async () => {
    enableAuthz();
    _StorageFolder.getInstance = (() => ({
      findOne: async (query: { name?: string }) =>
        query.name === 'cnd_other/' ? { _id: 'dir1' } : null,
    })) as unknown as typeof _StorageFolder.getInstance;
    const { grpcSdk } = fakeSdk();
    await assert.rejects(
      () => assertNoPersonalFolderSquat(grpcSdk, 'cnd_other/', 'self', 'conduit'),
      (error: unknown) =>
        error instanceof GrpcError && error.code === status.PERMISSION_DENIED,
    );
  });

  it('allows a managed personal root of another user so folder can(edit) applies next', async () => {
    enableAuthz();
    _StorageFolder.getInstance = (() => ({
      findOne: async (query: { name?: string }) =>
        query.name === 'cnd_other/' ? { _id: 'dir1' } : null,
    })) as unknown as typeof _StorageFolder.getInstance;
    const { grpcSdk } = fakeSdk({ managed: ['Folder:dir1'] });
    await assertNoPersonalFolderSquat(grpcSdk, 'cnd_other/sub/', 'self', 'conduit');
  });
});

describe('assertFolderEditAccess', () => {
  it('skips can(edit) when the whole path is leftover and unmanaged', async () => {
    enableAuthz();
    _StorageFolder.getInstance = (() => ({
      findOne: async (query: { name?: string }) =>
        query.name === 'docs/' ? { _id: 'docs', name: 'docs/' } : null,
    })) as unknown as typeof _StorageFolder.getInstance;
    let canCalls = 0;
    const { grpcSdk } = fakeSdk();
    grpcSdk.authorization!.can = async () => {
      canCalls += 1;
      return { allow: false };
    };
    await assertFolderEditAccess(grpcSdk, 'conduit', 'docs/', 'User:alice');
    assert.equal(canCalls, 0);
  });

  it('walks through an unmanaged child and can(edit) the managed parent', async () => {
    enableAuthz();
    _StorageFolder.getInstance = (() => ({
      findOne: async (query: { name?: string }) => {
        if (query.name === 'docs/secret/') return { _id: 'secret', name: 'docs/secret/' };
        if (query.name === 'docs/') return { _id: 'docs', name: 'docs/' };
        return null;
      },
    })) as unknown as typeof _StorageFolder.getInstance;
    const { grpcSdk } = fakeSdk({ managed: ['Folder:docs'] });
    await assertFolderEditAccess(grpcSdk, 'conduit', 'docs/secret/', 'User:owner');
    await assert.rejects(
      () => assertFolderEditAccess(grpcSdk, 'conduit', 'docs/secret/', 'User:bob'),
      (error: unknown) =>
        error instanceof GrpcError && error.code === status.PERMISSION_DENIED,
    );
  });

  it('fails closed when findRelation throws', async () => {
    enableAuthz();
    _StorageFolder.getInstance = (() => ({
      findOne: async () => ({ _id: 'docs', name: 'docs/' }),
    })) as unknown as typeof _StorageFolder.getInstance;
    const { grpcSdk } = fakeSdk({ findRelationError: new Error('authorization down') });
    await assert.rejects(
      () => assertFolderEditAccess(grpcSdk, 'conduit', 'docs/', 'User:alice'),
      (error: unknown) =>
        error instanceof Error && error.message === 'authorization down',
    );
  });
});

describe('findOrCreateFolders', () => {
  it('does not create a scope owner when admin omits scope', async () => {
    enableAuthz();
    const created: Array<{ subject: string; relation: string; resource: string }> = [];
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

    const { grpcSdk } = fakeSdk({ created });
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

  it('heals leftover unowned folders and a named container on write', async () => {
    enableAuthz();
    const created: Array<{ subject: string; relation: string; resource: string }> = [];
    const folders = [
      { _id: 'docs', name: 'docs/', container: 'photos' },
      { _id: 'nested', name: 'docs/nested/', container: 'photos' },
    ];
    _StorageContainer.getInstance = (() => ({
      findOne: async () => ({ _id: 'c2', name: 'photos' }),
    })) as unknown as typeof _StorageContainer.getInstance;
    _StorageFolder.getInstance = (() => ({
      findOne: async (query: { name?: string }) =>
        folders.find(folder => folder.name === query.name) ?? null,
    })) as unknown as typeof _StorageFolder.getInstance;

    const { grpcSdk } = fakeSdk({ created });
    const storage = {
      container: () => ({
        folderExists: async () => true,
        createFolder: async () => true,
      }),
    };

    const result = await findOrCreateFolders(
      grpcSdk,
      storage as never,
      'docs/nested/',
      'photos',
      { scope: 'User:alice' },
    );
    assert.equal(result.length, 0);
    assert.deepEqual(created, [
      { subject: 'User:alice', relation: 'owner', resource: 'Container:c2' },
      { subject: 'Container:c2', relation: 'owner', resource: 'Folder:docs' },
      { subject: 'User:alice', relation: 'owner', resource: 'Folder:docs' },
      { subject: 'Folder:docs', relation: 'owner', resource: 'Folder:nested' },
      { subject: 'User:alice', relation: 'owner', resource: 'Folder:nested' },
    ]);
  });

  it('does not rewrite relations on a folder that is already managed', async () => {
    enableAuthz();
    const created: Array<{ subject: string; relation: string; resource: string }> = [];
    _StorageContainer.getInstance = (() => ({
      findOne: async () => ({ _id: 'c1', name: 'conduit' }),
    })) as unknown as typeof _StorageContainer.getInstance;
    _StorageFolder.getInstance = (() => ({
      findOne: async () => ({ _id: 'docs', name: 'docs/', container: 'conduit' }),
    })) as unknown as typeof _StorageFolder.getInstance;

    const { grpcSdk } = fakeSdk({ created, managed: ['Folder:docs'] });
    await findOrCreateFolders(
      grpcSdk,
      {
        container: () => ({
          folderExists: async () => true,
          createFolder: async () => true,
        }),
      } as never,
      'docs/',
      'conduit',
      { scope: 'User:bob' },
    );
    assert.deepEqual(created, []);
  });

  it('heals a named container when writing at /', async () => {
    enableAuthz();
    const created: Array<{ subject: string; relation: string; resource: string }> = [];
    _StorageContainer.getInstance = (() => ({
      findOne: async () => ({ _id: 'c2', name: 'photos' }),
    })) as unknown as typeof _StorageContainer.getInstance;
    const { grpcSdk } = fakeSdk({ created });
    await findOrCreateFolders(
      grpcSdk,
      { container: () => ({}) } as never,
      '/',
      'photos',
      { scope: 'Team:t1' },
    );
    assert.deepEqual(created, [
      { subject: 'Team:t1', relation: 'owner', resource: 'Container:c2' },
    ]);
  });

  it('never owns the default container when writing at /', async () => {
    enableAuthz();
    const created: Array<{ subject: string; relation: string; resource: string }> = [];
    _StorageContainer.getInstance = (() => ({
      findOne: async () => ({ _id: 'c1', name: 'conduit' }),
    })) as unknown as typeof _StorageContainer.getInstance;
    const { grpcSdk } = fakeSdk({ created });
    await findOrCreateFolders(
      grpcSdk,
      { container: () => ({}) } as never,
      '/',
      'conduit',
      { scope: 'User:alice' },
    );
    assert.deepEqual(created, []);
  });
});
