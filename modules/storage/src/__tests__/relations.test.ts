import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigController } from '@conduitplatform/module-tools';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { _StorageContainer, _StorageFolder } from '../models/index.js';
import {
  createContainerOwnerRelation,
  createFileRelations,
  createFolderOwnerRelations,
  createOwnerRelation,
  forEachDocumentPage,
  hasManagedRelations,
  healUnmanagedContainer,
  healUnmanagedFolder,
  updateFileRelations,
} from '../authz/relations.js';

const originalConfig = ConfigController.getInstance().config;
const originalContainerGetInstance =
  _StorageContainer.getInstance.bind(_StorageContainer);
const originalFolderGetInstance = _StorageFolder.getInstance.bind(_StorageFolder);

afterEach(() => {
  ConfigController.getInstance().config = originalConfig;
  _StorageContainer.getInstance = originalContainerGetInstance;
  _StorageFolder.getInstance = originalFolderGetInstance;
});

function enableAuthz(defaultContainer = 'conduit') {
  ConfigController.getInstance().config = {
    authorization: { enabled: true },
    defaultContainer,
  };
}

function disableAuthz() {
  ConfigController.getInstance().config = {
    authorization: { enabled: false },
    defaultContainer: 'conduit',
  };
}

function stubLookups(args: {
  containers?: Array<{ _id: string; name: string }>;
  folders?: Array<{ _id: string; name: string; container: string }>;
}) {
  _StorageContainer.getInstance = (() => ({
    findOne: async (query: { name?: string }) =>
      args.containers?.find(doc => doc.name === query.name) ?? null,
  })) as unknown as typeof _StorageContainer.getInstance;
  _StorageFolder.getInstance = (() => ({
    findOne: async (query: { name?: string; container?: string }) =>
      args.folders?.find(
        doc => doc.name === query.name && doc.container === query.container,
      ) ?? null,
  })) as unknown as typeof _StorageFolder.getInstance;
}

function fakeSdk(args?: { managed?: string[]; findRelationError?: Error }) {
  const created: Array<{ subject: string; relation: string; resource: string }> = [];
  const deleted: Array<{ subject: string; relation: string; resource: string }> = [];
  const managed = new Set(args?.managed ?? []);
  const grpcSdk = {
    authorization: {
      createRelation: async (relation: {
        subject: string;
        relation: string;
        resource: string;
      }) => {
        created.push(relation);
      },
      deleteRelation: async (relation: {
        subject: string;
        relation: string;
        resource: string;
      }) => {
        deleted.push(relation);
      },
      findRelation: async ({ resource }: { resource: string }) => {
        if (args?.findRelationError) {
          throw args.findRelationError;
        }
        const relations = managed.has(resource)
          ? [{ subject: 'User:owner', relation: 'owner', resource }]
          : [];
        return { relations, count: relations.length };
      },
    },
  } as unknown as ConduitGrpcSdk;
  return { grpcSdk, created, deleted };
}

describe('relation subjects', () => {
  it('never creates a relation with an undefined subject', async () => {
    enableAuthz();
    const { grpcSdk, created } = fakeSdk();
    await createOwnerRelation(grpcSdk, undefined, 'File:1');
    await createOwnerRelation(grpcSdk, '', 'File:1');
    assert.deepEqual(created, []);
  });

  it('does not own the default container even when a scope is provided', async () => {
    enableAuthz();
    const { grpcSdk, created } = fakeSdk();
    await createContainerOwnerRelation(
      grpcSdk,
      { _id: 'c1', name: 'conduit' } as never,
      'Team:t1',
    );
    assert.deepEqual(created, []);
  });

  it('attaches scope to a non-default container', async () => {
    enableAuthz();
    const { grpcSdk, created } = fakeSdk();
    await createContainerOwnerRelation(
      grpcSdk,
      { _id: 'c2', name: 'team-bucket' } as never,
      'Team:t1',
    );
    assert.deepEqual(created, [
      { subject: 'Team:t1', relation: 'owner', resource: 'Container:c2' },
    ]);
  });

  it('skips all relation writes when authz is disabled', async () => {
    disableAuthz();
    const { grpcSdk, created } = fakeSdk();
    await createOwnerRelation(grpcSdk, 'User:1', 'File:1');
    assert.deepEqual(created, []);
  });
});

describe('file relation tree', () => {
  it('attaches container + scope for a root file', async () => {
    enableAuthz();
    stubLookups({ containers: [{ _id: 'c1', name: 'photos' }] });
    const { grpcSdk, created } = fakeSdk();
    await createFileRelations(
      grpcSdk,
      { _id: 'f1', container: 'photos', folder: '/' } as never,
      { scope: 'Team:t1' },
    );
    assert.deepEqual(created, [
      { subject: 'Container:c1', relation: 'owner', resource: 'File:f1' },
      { subject: 'Team:t1', relation: 'owner', resource: 'File:f1' },
    ]);
  });

  it('attaches the creating user when a root file has no scope', async () => {
    enableAuthz();
    stubLookups({ containers: [{ _id: 'c1', name: 'conduit' }] });
    const { grpcSdk, created } = fakeSdk();
    await createFileRelations(
      grpcSdk,
      { _id: 'f1', container: 'conduit', folder: '/' } as never,
      { userId: 'u1' },
    );
    assert.deepEqual(created, [
      { subject: 'Container:c1', relation: 'owner', resource: 'File:f1' },
      { subject: 'User:u1', relation: 'owner', resource: 'File:f1' },
    ]);
  });

  it('also stamps the creating user on a nested file without scope', async () => {
    enableAuthz();
    stubLookups({
      folders: [{ _id: 'dir1', name: 'cnd_u1/', container: 'conduit' }],
    });
    const { grpcSdk, created } = fakeSdk();
    await createFileRelations(
      grpcSdk,
      { _id: 'f1', container: 'conduit', folder: 'cnd_u1/' } as never,
      { userId: 'u1' },
    );
    assert.deepEqual(created, [
      { subject: 'Folder:dir1', relation: 'owner', resource: 'File:f1' },
      { subject: 'User:u1', relation: 'owner', resource: 'File:f1' },
    ]);
  });

  it('stamps scope instead of User when both are provided', async () => {
    enableAuthz();
    stubLookups({
      folders: [{ _id: 'dir1', name: 'docs/', container: 'conduit' }],
    });
    const { grpcSdk, created } = fakeSdk();
    await createFileRelations(
      grpcSdk,
      { _id: 'f1', container: 'conduit', folder: 'docs/' } as never,
      { scope: 'Team:t1', userId: 'u1' },
    );
    assert.deepEqual(created, [
      { subject: 'Folder:dir1', relation: 'owner', resource: 'File:f1' },
      { subject: 'Team:t1', relation: 'owner', resource: 'File:f1' },
    ]);
  });

  it('does not invent a user on admin creates without userId or scope', async () => {
    enableAuthz();
    stubLookups({
      folders: [{ _id: 'dir1', name: 'docs/', container: 'conduit' }],
    });
    const { grpcSdk, created } = fakeSdk();
    await createFileRelations(grpcSdk, {
      _id: 'f1',
      container: 'conduit',
      folder: 'docs/',
    } as never);
    assert.deepEqual(created, [
      { subject: 'Folder:dir1', relation: 'owner', resource: 'File:f1' },
    ]);
  });
});

describe('move owners', () => {
  it('rewires container-only moves at /', async () => {
    enableAuthz();
    stubLookups({
      containers: [
        { _id: 'c1', name: 'old' },
        { _id: 'c2', name: 'new' },
      ],
    });
    const { grpcSdk, created, deleted } = fakeSdk();
    await updateFileRelations(
      grpcSdk,
      { _id: 'f1', container: 'old', folder: '/' },
      { _id: 'f1', container: 'new', folder: '/' },
    );
    assert.deepEqual(deleted, [
      { subject: 'Container:c1', relation: 'owner', resource: 'File:f1' },
    ]);
    assert.deepEqual(created, [
      { subject: 'Container:c2', relation: 'owner', resource: 'File:f1' },
    ]);
  });

  it('moves / to a folder by dropping the container owner', async () => {
    enableAuthz();
    stubLookups({
      containers: [{ _id: 'c1', name: 'conduit' }],
      folders: [{ _id: 'dir1', name: 'docs/', container: 'conduit' }],
    });
    const { grpcSdk, created, deleted } = fakeSdk();
    await updateFileRelations(
      grpcSdk,
      { _id: 'f1', container: 'conduit', folder: '/' },
      { _id: 'f1', container: 'conduit', folder: 'docs/' },
      { scope: 'Team:t1' },
    );
    assert.deepEqual(deleted, [
      { subject: 'Container:c1', relation: 'owner', resource: 'File:f1' },
    ]);
    assert.deepEqual(created, [
      { subject: 'Folder:dir1', relation: 'owner', resource: 'File:f1' },
      { subject: 'Team:t1', relation: 'owner', resource: 'File:f1' },
    ]);
  });

  it('moves a folder file back to / by attaching the container', async () => {
    enableAuthz();
    stubLookups({
      containers: [{ _id: 'c1', name: 'conduit' }],
      folders: [{ _id: 'dir1', name: 'docs/', container: 'conduit' }],
    });
    const { grpcSdk, created, deleted } = fakeSdk();
    await updateFileRelations(
      grpcSdk,
      { _id: 'f1', container: 'conduit', folder: 'docs/' },
      { _id: 'f1', container: 'conduit', folder: '/' },
    );
    assert.deepEqual(deleted, [
      { subject: 'Folder:dir1', relation: 'owner', resource: 'File:f1' },
    ]);
    assert.deepEqual(created, [
      { subject: 'Container:c1', relation: 'owner', resource: 'File:f1' },
    ]);
  });

  it('treats the same folder path in another container as a new folder owner', async () => {
    enableAuthz();
    stubLookups({
      folders: [
        { _id: 'dir-old', name: 'docs/', container: 'old' },
        { _id: 'dir-new', name: 'docs/', container: 'new' },
      ],
    });
    const { grpcSdk, created, deleted } = fakeSdk();
    await updateFileRelations(
      grpcSdk,
      { _id: 'f1', container: 'old', folder: 'docs/' },
      { _id: 'f1', container: 'new', folder: 'docs/' },
    );
    assert.deepEqual(deleted, [
      { subject: 'Folder:dir-old', relation: 'owner', resource: 'File:f1' },
    ]);
    assert.deepEqual(created, [
      { subject: 'Folder:dir-new', relation: 'owner', resource: 'File:f1' },
    ]);
  });

  it('adds the new structural owner when the old folder row is missing', async () => {
    enableAuthz();
    stubLookups({
      folders: [{ _id: 'dir-new', name: 'docs/', container: 'conduit' }],
    });
    const { grpcSdk, created, deleted } = fakeSdk();
    await updateFileRelations(
      grpcSdk,
      { _id: 'f1', container: 'conduit', folder: 'gone/' },
      { _id: 'f1', container: 'conduit', folder: 'docs/' },
    );
    assert.deepEqual(deleted, []);
    assert.deepEqual(created, [
      { subject: 'Folder:dir-new', relation: 'owner', resource: 'File:f1' },
    ]);
  });

  it('ignores a missing old structural relation and still adds the new owner', async () => {
    enableAuthz();
    stubLookups({
      folders: [
        { _id: 'dir-old', name: 'old/', container: 'conduit' },
        { _id: 'dir-new', name: 'docs/', container: 'conduit' },
      ],
    });
    const { grpcSdk, created, deleted } = fakeSdk();
    grpcSdk.authorization!.deleteRelation = async relation => {
      deleted.push(relation);
      throw new Error('No relations found');
    };
    await updateFileRelations(
      grpcSdk,
      { _id: 'f1', container: 'conduit', folder: 'old/' },
      { _id: 'f1', container: 'conduit', folder: 'docs/' },
    );
    assert.equal(deleted.length, 1);
    assert.deepEqual(created, [
      { subject: 'Folder:dir-new', relation: 'owner', resource: 'File:f1' },
    ]);
  });

  it('does not rewire relations when authz is disabled', async () => {
    disableAuthz();
    stubLookups({
      folders: [
        { _id: 'dir-old', name: 'old/', container: 'conduit' },
        { _id: 'dir-new', name: 'docs/', container: 'conduit' },
      ],
    });
    const { grpcSdk, created, deleted } = fakeSdk();
    await updateFileRelations(
      grpcSdk,
      { _id: 'f1', container: 'conduit', folder: 'old/' },
      { _id: 'f1', container: 'conduit', folder: 'docs/' },
    );
    assert.deepEqual(deleted, []);
    assert.deepEqual(created, []);
  });

  it('adds a scope owner on update without removing an existing user owner', async () => {
    enableAuthz();
    stubLookups({
      folders: [{ _id: 'dir1', name: 'docs/', container: 'conduit' }],
    });
    const { grpcSdk, created, deleted } = fakeSdk();
    await updateFileRelations(
      grpcSdk,
      { _id: 'f1', container: 'conduit', folder: 'docs/' },
      { _id: 'f1', container: 'conduit', folder: 'docs/' },
      { scope: 'Team:t1' },
    );
    assert.deepEqual(deleted, []);
    assert.deepEqual(created, [
      { subject: 'Team:t1', relation: 'owner', resource: 'File:f1' },
    ]);
  });
});

describe('managed relation probe', () => {
  it('treats owner/editor/reader rows as managed and empty as unmanaged', async () => {
    enableAuthz();
    const { grpcSdk } = fakeSdk({ managed: ['Folder:1'] });
    assert.equal(await hasManagedRelations(grpcSdk, 'Folder:1'), true);
    assert.equal(await hasManagedRelations(grpcSdk, 'Folder:2'), false);
  });

  it('fails closed when findRelation throws', async () => {
    enableAuthz();
    const { grpcSdk } = fakeSdk({ findRelationError: new Error('down') });
    await assert.rejects(() => hasManagedRelations(grpcSdk, 'Folder:1'), /down/);
  });

  it('does not heal a managed container or the default container', async () => {
    enableAuthz();
    const { grpcSdk, created } = fakeSdk({ managed: ['Container:c2'] });
    await healUnmanagedContainer(
      grpcSdk,
      { _id: 'c1', name: 'conduit' } as never,
      'User:alice',
    );
    await healUnmanagedContainer(
      grpcSdk,
      { _id: 'c2', name: 'photos' } as never,
      'User:alice',
    );
    assert.deepEqual(created, []);
  });

  it('heals an unowned named container and first folder like a new first folder', async () => {
    enableAuthz();
    const { grpcSdk, created } = fakeSdk();
    await healUnmanagedContainer(
      grpcSdk,
      { _id: 'c2', name: 'photos' } as never,
      'User:alice',
    );
    await healUnmanagedFolder(grpcSdk, { _id: 'docs' } as never, {
      isFirst: true,
      containerId: 'c2',
      scope: 'User:alice',
    });
    assert.deepEqual(created, [
      { subject: 'User:alice', relation: 'owner', resource: 'Container:c2' },
      { subject: 'Container:c2', relation: 'owner', resource: 'Folder:docs' },
      { subject: 'User:alice', relation: 'owner', resource: 'Folder:docs' },
    ]);
  });
});

describe('folder owners', () => {
  it('owns the first folder with the container only when admin omits scope', async () => {
    enableAuthz();
    const { grpcSdk, created } = fakeSdk();
    await createFolderOwnerRelations(grpcSdk, { _id: 'dir1' } as never, {
      isFirst: true,
      containerId: 'c1',
    });
    assert.deepEqual(created, [
      { subject: 'Container:c1', relation: 'owner', resource: 'Folder:dir1' },
    ]);
    assert.equal(
      created.some(relation => relation.subject === 'undefined'),
      false,
    );
  });

  it('attaches scope on a first folder and parent folder on nested folders', async () => {
    enableAuthz();
    const { grpcSdk, created } = fakeSdk();
    await createFolderOwnerRelations(grpcSdk, { _id: 'dir1' } as never, {
      isFirst: true,
      containerId: 'c1',
      scope: 'Team:t1',
    });
    await createFolderOwnerRelations(grpcSdk, { _id: 'dir2' } as never, {
      isFirst: false,
      containerId: 'c1',
      parentFolderId: 'dir1',
    });
    assert.deepEqual(created, [
      { subject: 'Container:c1', relation: 'owner', resource: 'Folder:dir1' },
      { subject: 'Team:t1', relation: 'owner', resource: 'Folder:dir1' },
      { subject: 'Folder:dir1', relation: 'owner', resource: 'Folder:dir2' },
    ]);
  });
});

describe('paginated relation cleanup', () => {
  it('walks pages instead of loading every id at once', async () => {
    const pages = [[{ _id: '1' }, { _id: '2' }], [{ _id: '3' }]];
    const seen: string[][] = [];
    let calls = 0;
    await forEachDocumentPage(
      async (skip, limit) => {
        assert.equal(limit, 2);
        calls += 1;
        return pages[skip / 2] ?? [];
      },
      async docs => {
        seen.push(docs.map(doc => doc._id));
      },
      2,
    );
    assert.equal(calls, 2);
    assert.deepEqual(seen, [['1', '2'], ['3']]);
  });
});
