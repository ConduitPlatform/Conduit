import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type {
  ConduitGrpcSdk,
  ConduitRouteOptions,
  DatabaseProvider,
} from '@conduitplatform/grpc-sdk';
import { ConfigController, GrpcServer } from '@conduitplatform/module-tools';
import { StorageRoutes } from './index.js';
import { FileHandlers } from '../handlers/file.js';
import { File } from '../models/index.js';

// The return definitions read the File model fields; no database calls are made.
File.getInstance({} as DatabaseProvider);

const originalConfig = ConfigController.getInstance().config;

afterEach(() => {
  ConfigController.getInstance().config = originalConfig;
});

function setConfig(rateLimits?: unknown) {
  ConfigController.getInstance().config = {
    authorization: { enabled: false },
    ...(rateLimits !== undefined && { rateLimits }),
  };
}

/** Registers the client routes and returns the options of the rate limited ones. */
async function limitedRoutes(routes: StorageRoutes): Promise<ConduitRouteOptions[]> {
  const registered: ConduitRouteOptions[] = [];
  (routes as unknown as { _routingManager: unknown })._routingManager = {
    clear: () => registered.splice(0),
    route: (options: ConduitRouteOptions) => registered.push(options),
    registerRoutes: async () => {},
  };
  await routes.registerRoutes(true);
  return registered.filter(r => r.rateLimit);
}

function createRoutes() {
  return new StorageRoutes(
    {} as GrpcServer,
    { router: {} } as unknown as ConduitGrpcSdk,
    {
      createFile: () => {},
      createFileUploadUrl: () => {},
      updateFileUploadUrl: () => {},
      updateFile: () => {},
      getFile: () => {},
      getFileUrl: () => {},
      getFileData: () => {},
      deleteFile: () => {},
    } as unknown as FileHandlers,
  );
}

describe('storage write route rate limit registration', () => {
  it('registers the write routes with the default limit', async () => {
    setConfig();
    const limited = await limitedRoutes(createRoutes());
    assert.deepEqual(limited.map(r => `${r.action} ${r.path}`).sort(), [
      'PATCH /storage/file/:id',
      'PATCH /storage/upload/:id',
      'POST /storage/file',
      'POST /storage/upload',
    ]);
    for (const route of limited) {
      assert.deepEqual(route.rateLimit, { maxRequests: 60, resetInterval: 3600 });
    }
  });

  it('applies a changed config on the next registration', async () => {
    const routes = createRoutes();
    setConfig({ write: { maxRequests: 200, resetInterval: 3600 } });
    for (const route of await limitedRoutes(routes)) {
      assert.deepEqual(route.rateLimit, { maxRequests: 200, resetInterval: 3600 });
    }
    setConfig({ write: { maxRequests: 5, resetInterval: 60 } });
    const limited = await limitedRoutes(routes);
    assert.equal(limited.length, 4);
    for (const route of limited) {
      assert.deepEqual(route.rateLimit, { maxRequests: 5, resetInterval: 60 });
    }
  });
});
