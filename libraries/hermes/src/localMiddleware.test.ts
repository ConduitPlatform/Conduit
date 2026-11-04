import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ConduitGrpcSdk, ConduitRouteParameters } from '@conduitplatform/grpc-sdk';
import { ConduitRouter } from './Router.js';
import { ConduitMiddleware } from './interfaces/index.js';

class TestRouter extends ConduitRouter {
  constructor() {
    super({} as ConduitGrpcSdk);
  }
  protected _refreshRouter() {}
}

function makeParams(): ConduitRouteParameters {
  return { headers: {}, cookies: {}, context: {} } as unknown as ConduitRouteParameters;
}

function grpcMiddleware(name: string, calls: string[], result?: unknown, fail = false) {
  return new ConduitMiddleware({}, name, async () => {
    calls.push(`grpc:${name}`);
    if (fail) throw new Error('grpc failed');
    return { result: result === undefined ? undefined : JSON.stringify(result) };
  });
}

describe('local middlewares', () => {
  it('runs a local middleware and merges its result into context', async () => {
    const router = new TestRouter();
    router.registerLocalMiddleware('auth', async () => ({ user: 'u1' }));
    const params = makeParams();
    await router.checkMiddlewares(params, ['auth']);
    assert.deepEqual(params.context, { user: 'u1' });
  });

  it('accepts a handler returning void', async () => {
    const router = new TestRouter();
    router.registerLocalMiddleware('noop', async () => {});
    const params = makeParams();
    await router.checkMiddlewares(params, ['noop']);
    assert.deepEqual(params.context, {});
  });

  it('takes precedence over a gRPC middleware of the same name', async () => {
    const router = new TestRouter();
    const calls: string[] = [];
    router.registerMiddleware(grpcMiddleware('auth', calls, { from: 'grpc' }), 'mod:1');
    router.registerLocalMiddleware('auth', async () => {
      calls.push('local:auth');
      return { from: 'local' };
    });
    const params = makeParams();
    await router.checkMiddlewares(params, ['auth']);
    assert.deepEqual(calls, ['local:auth']);
    assert.deepEqual(params.context, { from: 'local' });
  });

  it('falls back to gRPC after unregisterLocalMiddleware and for other names', async () => {
    const router = new TestRouter();
    const calls: string[] = [];
    router.registerMiddleware(grpcMiddleware('auth', calls, { from: 'grpc' }), 'mod:1');
    router.registerMiddleware(grpcMiddleware('other', calls, { o: 1 }), 'mod:1');
    router.registerLocalMiddleware('auth', async () => ({ from: 'local' }));
    router.unregisterLocalMiddleware('auth');
    const params = makeParams();
    await router.checkMiddlewares(params, ['auth', 'other']);
    assert.deepEqual(calls, ['grpc:auth', 'grpc:other']);
    assert.deepEqual(params.context, { from: 'grpc', o: 1 });
  });

  it('propagates local errors for required middlewares', async () => {
    const router = new TestRouter();
    router.registerLocalMiddleware('auth', async () => {
      throw new Error('nope');
    });
    await assert.rejects(router.checkMiddlewares(makeParams(), ['auth']), /nope/);
  });

  it('swallows local errors for the optional `?` form and continues the chain', async () => {
    const router = new TestRouter();
    router.registerLocalMiddleware('auth', async () => {
      throw new Error('nope');
    });
    router.registerLocalMiddleware('next', async () => ({ ran: true }));
    const params = makeParams();
    await router.checkMiddlewares(params, ['auth?', 'next']);
    assert.deepEqual(params.context, { ran: true });
  });

  it('local optional form also shadows a failing gRPC middleware', async () => {
    const router = new TestRouter();
    const calls: string[] = [];
    router.registerMiddleware(grpcMiddleware('auth', calls, undefined, true), 'mod:1');
    router.registerLocalMiddleware('auth', async () => ({ ok: 1 }));
    const params = makeParams();
    await router.checkMiddlewares(params, ['auth?']);
    assert.deepEqual(calls, []);
    assert.deepEqual(params.context, { ok: 1 });
  });

  it('still rejects unknown middlewares', async () => {
    const router = new TestRouter();
    await assert.rejects(router.checkMiddlewares(makeParams(), ['missing']));
  });

  it('sync throw: required form rejects, optional form is swallowed', async () => {
    const router = new TestRouter();
    const syncThrow = (() => {
      throw new Error('sync');
    }) as unknown as () => Promise<void>;
    router.registerLocalMiddleware('bad', syncThrow);
    router.registerLocalMiddleware('next', async () => ({ ran: true }));
    await assert.rejects(router.checkMiddlewares(makeParams(), ['bad']), /sync/);
    const params = makeParams();
    await router.checkMiddlewares(params, ['bad?', 'next']);
    assert.deepEqual(params.context, { ran: true });
  });

  it('accepts non-promise returns', async () => {
    const router = new TestRouter();
    router.registerLocalMiddleware('plain', (() => ({ p: 1 })) as any);
    const params = makeParams();
    await router.checkMiddlewares(params, ['plain']);
    assert.deepEqual(params.context, { p: 1 });
  });

  it('does not let route handlers mutate a cached returned object', async () => {
    const router = new TestRouter();
    const cached = { user: 'u' };
    router.registerLocalMiddleware('auth', async () => cached);
    const params = makeParams();
    await router.checkMiddlewares(params, ['auth']);
    (params.context as any).extra = 1;
    assert.deepEqual(cached, { user: 'u' });
  });
});
