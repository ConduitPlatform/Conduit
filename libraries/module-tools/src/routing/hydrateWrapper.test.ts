import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '@grpc/grpc-js';
import { Admin, ConduitRouteActions, GrpcError } from '@conduitplatform/grpc-sdk';
import { RoutingManager, RouteBuilder } from '../../dist/index.esm.js';

type Handler = (call: any, cb: any) => void;

function setup(admin = false) {
  let routes: Record<string, Handler> = {};
  const registered: any[] = [];
  (RoutingManager as any).ClientController = { setRoutes: (r: any) => (routes = r) };
  (RoutingManager as any).AdminController = { setRoutes: (r: any) => (routes = r) };
  const router: any = admin ? Object.create(Admin.prototype) : {};
  router.register = async (p: any) => registered.push(p);
  const manager = new RoutingManager(router, {} as any);
  return { manager, run: (name: string) => routes[name], registered };
}

const ret = { name: 'R', fields: 'String' } as any;
const mkCall = (context: any) => ({
  request: {
    path: '/x',
    context: JSON.stringify(context),
    params: '',
    cookies: '',
    urlParams: '',
    queryParams: '',
    bodyParams: '',
    headers: '',
  },
});
const invoke = (fn: Handler, context: any) =>
  new Promise<{ err: any; res: any }>(resolve =>
    fn(mkCall(context), (err: any, res: any) => resolve({ err, res })),
  );
const opts = (extra: any = {}) => ({
  action: ConduitRouteActions.GET,
  path: '/x',
  name: 'Foo',
  middlewares: ['authMiddleware'],
  ...extra,
});
const echoUser = async (call: any) => ({ user: call.request.context.user ?? null });

describe('route wrapper hydration', () => {
  beforeEach(() => {
    RoutingManager.setUserResolver(async id => ({ _id: id }));
  });
  afterEach(() => {
    RoutingManager.setUserResolver(undefined);
  });

  it('hydrates context.user via the resolver override', async () => {
    const { manager, run } = setup();
    manager.route(opts(), ret, echoUser);
    await manager.registerRoutes();
    const { res } = await invoke(run('Foo'), { userId: 'u1' });
    assert.deepEqual(JSON.parse(res.result), { user: { _id: 'u1' } });
  });

  it('passes session-mode requests through untouched', async () => {
    let calls = 0;
    RoutingManager.setUserResolver(async () => (calls++, {}));
    const { manager, run } = setup();
    manager.route(opts(), ret, echoUser);
    await manager.registerRoutes();
    const { res } = await invoke(run('Foo'), { userId: 'u1', user: { _id: 'session' } });
    assert.deepEqual(JSON.parse(res.result), { user: { _id: 'session' } });
    assert.equal(calls, 0);
  });

  it('maps lookup errors to gRPC codes', async () => {
    const cases: [number, number][] = [
      [status.NOT_FOUND, status.UNAUTHENTICATED],
      [status.PERMISSION_DENIED, status.PERMISSION_DENIED],
      [status.UNAVAILABLE, status.UNAVAILABLE],
      [status.DEADLINE_EXCEEDED, status.DEADLINE_EXCEEDED],
    ];
    for (const [from, to] of cases) {
      RoutingManager.setUserResolver(async () => {
        throw new GrpcError(from, 'boom');
      });
      const { manager, run } = setup();
      manager.route(opts(), ret, echoUser);
      await manager.registerRoutes();
      const { err } = await invoke(run('Foo'), { userId: 'u1' });
      assert.equal(err.code, to);
    }
  });

  it('optional form leaves context untouched on failure', async () => {
    RoutingManager.setUserResolver(async () => {
      throw new GrpcError(status.NOT_FOUND, 'gone');
    });
    const { manager, run } = setup();
    manager.route(opts({ middlewares: ['authMiddleware?'] }), ret, echoUser);
    await manager.registerRoutes();
    const { err, res } = await invoke(run('Foo'), { userId: 'u1' });
    assert.equal(err, null);
    assert.deepEqual(JSON.parse(res.result), { user: null });
  });

  it('skips admin routes', async () => {
    const { manager, run } = setup(true);
    manager.route(opts(), ret, echoUser);
    await manager.registerRoutes();
    const { res } = await invoke(run('Foo'), { userId: 'u1' });
    assert.deepEqual(JSON.parse(res.result), { user: null });
  });

  const socketCall = (context: any) => ({
    request: {
      event: 'ping',
      socketId: 's',
      context: JSON.stringify(context),
      params: '',
      cookies: '',
      urlParams: '',
      queryParams: '',
      bodyParams: '',
    },
  });
  const socketRun = async (context: any) => {
    const { manager, run } = setup();
    manager.socket({ path: '/s', middlewares: ['authMiddleware'] } as any, {
      ping: {
        handler: async (c: any) => ({
          event: 'ping',
          data: { user: c.request.context.user ?? null },
        }),
      } as any,
    });
    await manager.registerRoutes();
    const out: any = await new Promise(r =>
      run('ping')(socketCall(context), (e: any, res: any) => r({ e, res })),
    );
    return JSON.parse(out.res.data);
  };

  it('hydrates socket events', async () => {
    assert.deepEqual(await socketRun({ userId: 'u1' }), { user: { _id: 'u1' } });
  });

  it('passes socket events through when user is set', async () => {
    assert.deepEqual(await socketRun({ userId: 'u1', user: { _id: 'x' } }), {
      user: { _id: 'x' },
    });
  });

  it('RouteBuilder.hydrateUser(false) disables hydration', async () => {
    const { manager, run } = setup();
    new RouteBuilder(manager)
      .method(ConduitRouteActions.GET)
      .path('/x')
      .name('Foo')
      .middleware('authMiddleware')
      .hydrateUser(false)
      .return('R', 'String' as any)
      .handler(echoUser as any)
      .add();
    await manager.registerRoutes();
    const { res } = await invoke(run('Foo'), { userId: 'u1' });
    assert.deepEqual(JSON.parse(res.result), { user: null });
  });
});
