import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '@grpc/grpc-js';
import {
  ConduitGrpcSdk,
  GrpcError,
  ParsedRouterRequest,
} from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { _StorageContainer, File } from '../models/index.js';
import { FileHandlers } from './file.js';

const originalConfig = ConfigController.getInstance().config;
const originalContainerGetInstance =
  _StorageContainer.getInstance.bind(_StorageContainer);
const originalFileGetInstance = File.getInstance.bind(File);

afterEach(() => {
  ConfigController.getInstance().config = originalConfig;
  _StorageContainer.getInstance = originalContainerGetInstance;
  File.getInstance = originalFileGetInstance;
});

function request(
  overrides: Partial<ParsedRouterRequest['request']> = {},
): ParsedRouterRequest {
  return {
    request: {
      params: {},
      urlParams: {},
      queryParams: {},
      bodyParams: {},
      path: '',
      headers: {},
      rawHeaders: [],
      rawBody: Buffer.alloc(0),
      context: {},
      cookies: {},
      ...overrides,
    },
  } as ParsedRouterRequest;
}

function stubModels(args: {
  containers?: Array<{ _id: string; name: string }>;
  files?: Array<Record<string, unknown>>;
}) {
  _StorageContainer.getInstance = (() => ({
    findOne: async (query: { name?: string }) =>
      args.containers?.find(doc => doc.name === query.name) ?? null,
    findMany: async (query: { name?: { $in: string[] } }) => {
      const names = query.name?.$in;
      return names
        ? (args.containers ?? []).filter(doc => names.includes(doc.name))
        : (args.containers ?? []);
    },
  })) as unknown as typeof _StorageContainer.getInstance;
  File.getInstance = (() => ({
    findOne: async (query: { _id?: string }) =>
      args.files?.find(doc => doc._id === query._id) ?? null,
    deleteOne: async () => undefined,
  })) as unknown as typeof File.getInstance;
}

function handlers(authz: {
  can?: (input: { actions: string[]; resource: string }) => Promise<{ allow: boolean }>;
  deleteAllRelations?: () => Promise<void>;
}) {
  const grpcSdk = {
    databaseProvider: {},
    authorization: {
      can: authz.can ?? (async () => ({ allow: true })),
      deleteAllRelations: authz.deleteAllRelations ?? (async () => undefined),
      createRelation: async () => undefined,
    },
  } as unknown as ConduitGrpcSdk;
  const storage = {
    container: () => ({
      delete: async () => true,
      getSignedUrl: async () => 'https://signed.example/file',
    }),
  };
  return new FileHandlers(grpcSdk, storage as never);
}

describe('client container create', () => {
  it('returns 404 for a missing container even when allowContainerCreation is true', async () => {
    ConfigController.getInstance().config = {
      authorization: { enabled: true },
      defaultContainer: 'conduit',
      allowContainerCreation: true,
    };
    stubModels({ containers: [{ _id: 'c1', name: 'conduit' }] });
    const fileHandlers = handlers({});
    await assert.rejects(
      () =>
        fileHandlers.createFile(
          request({
            params: { name: 'a.txt', data: 'Zg==', container: 'missing' },
            context: { user: { _id: 'u1' } },
          }),
        ),
      (error: unknown) =>
        error instanceof GrpcError &&
        error.code === status.NOT_FOUND &&
        error.message === 'Container does not exist',
    );
  });
});

describe('safe user access', () => {
  it('denies a private get without a user instead of throwing TypeError', async () => {
    ConfigController.getInstance().config = {
      authorization: { enabled: true },
      defaultContainer: 'conduit',
    };
    stubModels({
      files: [
        {
          _id: 'file-1',
          isPublic: false,
          name: 'secret.txt',
          container: 'conduit',
          folder: '/',
        },
      ],
    });
    const fileHandlers = handlers({});
    await assert.rejects(
      () => fileHandlers.getFile(request({ params: { id: 'file-1' }, context: {} })),
      (error: unknown) =>
        error instanceof GrpcError && error.code === status.PERMISSION_DENIED,
    );
  });

  it('allows public file read without auth', async () => {
    ConfigController.getInstance().config = {
      authorization: { enabled: true },
      defaultContainer: 'conduit',
    };
    stubModels({
      containers: [{ _id: 'c1', name: 'public' }],
      files: [
        {
          _id: 'file-2',
          isPublic: true,
          name: 'banner.png',
          container: 'public',
          folder: '/',
          url: 'https://cdn.example/banner.png',
        },
      ],
    });
    const fileHandlers = handlers({
      can: async () => {
        throw new Error('authz should not run for public reads');
      },
    });
    const result = (await fileHandlers.getFile(
      request({ params: { id: 'file-2' }, context: {} }),
    )) as { _id: string };
    assert.equal(result._id, 'file-2');
  });
});

describe('denied delete status', () => {
  it('keeps PERMISSION_DENIED instead of wrapping it as INTERNAL 500', async () => {
    ConfigController.getInstance().config = {
      authorization: { enabled: true },
      defaultContainer: 'conduit',
    };
    stubModels({
      files: [
        {
          _id: 'file-3',
          isPublic: false,
          name: 'a.txt',
          container: 'conduit',
          folder: '/',
        },
      ],
    });
    const fileHandlers = handlers({
      can: async () => ({ allow: false }),
    });
    await assert.rejects(
      () =>
        fileHandlers.deleteFile(
          request({
            params: { id: 'file-3' },
            context: { user: { _id: 'u1' } },
          }),
        ),
      (error: unknown) =>
        error instanceof GrpcError && error.code === status.PERMISSION_DENIED,
    );
  });
});

describe('gRPC deleteFile id', () => {
  it('deletes using params.id when urlParams is empty', async () => {
    ConfigController.getInstance().config = {
      authorization: { enabled: false },
      defaultContainer: 'conduit',
    };
    let deletedId: string | undefined;
    File.getInstance = (() => ({
      findOne: async (query: { _id?: string }) =>
        query._id === 'grpc-file'
          ? {
              _id: 'grpc-file',
              container: 'conduit',
              folder: '/',
              name: 'a.txt',
              size: 1,
            }
          : null,
      deleteOne: async (query: { _id?: string }) => {
        deletedId = query._id;
      },
    })) as unknown as typeof File.getInstance;
    const fileHandlers = handlers({});
    const result = (await fileHandlers.deleteFile(
      request({
        params: { id: 'grpc-file' },
        urlParams: {},
        context: { user: { _id: 'u1' } },
      }),
    )) as { success: boolean };
    assert.equal(result.success, true);
    assert.equal(deletedId, 'grpc-file');
  });
});

describe('scope and team', () => {
  it('denies create when the user cannot edit the given scope', async () => {
    ConfigController.getInstance().config = {
      authorization: { enabled: true },
      defaultContainer: 'conduit',
    };
    stubModels({ containers: [{ _id: 'c1', name: 'conduit' }] });
    const fileHandlers = handlers({
      can: async input => ({ allow: input.resource !== 'Team:t1' }),
    });
    await assert.rejects(
      () =>
        fileHandlers.fileAccessCheck(
          'create',
          request({
            params: { scope: 'Team:t1' },
            queryParams: { scope: 'Team:t1' },
            context: { user: { _id: 'u1' } },
          }).request,
          undefined,
          'conduit',
        ),
      (error: unknown) =>
        error instanceof GrpcError &&
        error.code === status.PERMISSION_DENIED &&
        error.message === 'You are not allowed to create files in this scope',
    );
  });
});

describe('authz disabled', () => {
  it('does not call authorization.can during create access checks', async () => {
    ConfigController.getInstance().config = {
      authorization: { enabled: false },
      defaultContainer: 'conduit',
      allowContainerCreation: true,
    };
    stubModels({ containers: [{ _id: 'c1', name: 'conduit' }] });
    let canCalls = 0;
    const fileHandlers = handlers({
      can: async () => {
        canCalls += 1;
        return { allow: false };
      },
    });
    await fileHandlers.fileAccessCheck(
      'create',
      request({
        params: {},
        context: { user: { _id: 'u1' } },
      }).request,
      undefined,
      'conduit',
    );
    assert.equal(canCalls, 0);
  });
});
