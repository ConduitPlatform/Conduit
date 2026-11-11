import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '@grpc/grpc-js';
import {
  Admin,
  ConduitError,
  ConduitRouteActions,
  defineErrors,
  getConduitCode,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { ModuleError, RoutingManager, toGrpcStatus } from '../../dist/index.esm.js';

type Handler = (call: any, cb: any) => void;

const errors = defineErrors({
  FILE_NOT_FOUND: {
    grpcCode: status.NOT_FOUND,
    message: 'File does not exist',
    description: 'No file matches the given id',
  },
  STORAGE_OPERATION_FAILED: {
    grpcCode: status.INTERNAL,
    message: 'Storage operation failed',
    description: 'The storage provider rejected the operation',
  },
});

function setup(admin = false) {
  let routes: Record<string, Handler> = {};
  (RoutingManager as any).ClientController = { setRoutes: (r: any) => (routes = r) };
  (RoutingManager as any).AdminController = { setRoutes: (r: any) => (routes = r) };
  const router: any = admin ? Object.create(Admin.prototype) : {};
  router.register = async () => {};
  const manager = new RoutingManager(router, {} as any);
  return { manager, run: (name: string) => routes[name] };
}

const ret = { name: 'R', fields: 'String' } as any;
const call = () => ({
  request: {
    path: '/x',
    context: '{}',
    params: '',
    cookies: '',
    urlParams: '',
    queryParams: '',
    bodyParams: '',
    headers: '',
  },
});

async function failWith(error: unknown, admin = false) {
  const { manager, run } = setup(admin);
  manager.route(
    { action: ConduitRouteActions.GET, path: '/x', name: 'Foo', hydrateUser: false },
    ret,
    async () => {
      throw error;
    },
  );
  await manager.registerRoutes();
  return new Promise<any>(resolve => run('Foo')(call(), (err: any) => resolve(err)));
}

describe('route wrapper error conversion', () => {
  it('sends typed errors as {message, conduitCode} with their gRPC status', async () => {
    const err = await failWith(new ModuleError(errors.FILE_NOT_FOUND, 'id=42'));
    assert.equal(err.code, status.NOT_FOUND);
    assert.deepEqual(JSON.parse(err.message), {
      message: 'File does not exist',
      conduitCode: 'FILE_NOT_FOUND',
    });
    assert.ok(!err.message.includes('id=42'), 'debugLogInfo stays in the log');
  });

  it('keeps plain GrpcErrors untouched', async () => {
    const err = await failWith(new GrpcError(status.PERMISSION_DENIED, 'nope'));
    assert.deepEqual(err, { code: status.PERMISSION_DENIED, message: 'nope' });
  });

  it('keeps the status and code of an error returned by another module', async () => {
    const details = JSON.stringify({ message: 'm', conduitCode: 'USER_NOT_FOUND' });
    const err = await failWith(
      Object.assign(new Error(`5 NOT_FOUND: ${details}`), { code: 5, details }),
    );
    assert.equal(err.code, status.NOT_FOUND);
    assert.equal(err.message, details);
  });

  it('maps a ConduitError to the matching gRPC status instead of INTERNAL', async () => {
    const err = await failWith(ConduitError.forbidden('Invalid schema types'));
    assert.deepEqual(err, {
      code: status.PERMISSION_DENIED,
      message: 'Invalid schema types',
    });
    const coded = await failWith(new ConduitError('X', 400, 'bad', 'BAD_THING'));
    assert.equal(coded.code, status.INVALID_ARGUMENT);
    assert.equal(getConduitCode(coded), 'BAD_THING');
  });

  it('never exposes unexpected failures on client routes', async () => {
    const driver = Object.assign(new Error('E11000 duplicate key: users.email'), {
      code: 11000,
    });
    const err = await failWith(driver);
    assert.equal(err.code, status.INTERNAL);
    assert.deepEqual(JSON.parse(err.message), {
      message: 'Something went wrong',
      conduitCode: 'INTERNAL_ERROR',
    });
  });

  it('appends the cause of a typed error on admin routes only', async () => {
    const failure = () =>
      new ModuleError(errors.STORAGE_OPERATION_FAILED, 'AccessDenied: bucket policy');
    const admin = await failWith(failure(), true);
    assert.equal(admin.code, status.INTERNAL);
    assert.deepEqual(JSON.parse(admin.message), {
      message: 'Storage operation failed: AccessDenied: bucket policy',
      conduitCode: 'STORAGE_OPERATION_FAILED',
    });
    const client = await failWith(failure());
    assert.equal(JSON.parse(client.message).message, 'Storage operation failed');
  });

  it('keeps the cause of unexpected failures on admin routes', async () => {
    const err = await failWith(new Error('E11000 duplicate key'), true);
    assert.deepEqual(err, { code: status.INTERNAL, message: 'E11000 duplicate key' });
  });
});

describe('ModuleError.rethrow', () => {
  it('wraps unknown causes and keeps their message for the log', async () => {
    const wrapped = await Promise.reject(new Error('connection reset'))
      .catch(ModuleError.rethrow(errors.STORAGE_OPERATION_FAILED))
      .catch(e => e);
    assert.ok(wrapped instanceof ModuleError);
    assert.equal(wrapped.conduitCode, 'STORAGE_OPERATION_FAILED');
    assert.equal(wrapped.debugLogInfo, 'connection reset');
    assert.equal(
      toGrpcStatus(wrapped).log,
      '[STORAGE_OPERATION_FAILED] Storage operation failed: connection reset',
    );
  });

  it('lets typed and gRPC errors pass through', async () => {
    const typed = new ModuleError(errors.FILE_NOT_FOUND);
    const passed = await Promise.reject(typed)
      .catch(ModuleError.rethrow(errors.STORAGE_OPERATION_FAILED))
      .catch(e => e);
    assert.equal(passed, typed);
  });
});
