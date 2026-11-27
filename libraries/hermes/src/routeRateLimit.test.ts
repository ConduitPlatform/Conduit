import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type {
  ConduitGrpcSdk,
  ConduitRouteOptions,
  ConduitRouteParameters,
} from '@conduitplatform/grpc-sdk';
import { ConduitError } from '@conduitplatform/grpc-sdk';
import { ConduitRouter } from './Router.js';
import { RestController } from './Rest/Rest.js';
import {
  HermesErrorCodes,
  retryAfterSeconds,
  RouteRateLimitError,
  toErrorResponse,
} from './utils/errors.js';

type FakeRedis = {
  counts: Map<string, number>;
  ttls: Map<string, number>;
  expires: [string, number][];
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
};

function fakeRedis(overrides: Partial<FakeRedis> = {}): FakeRedis {
  const redis: FakeRedis = {
    counts: new Map(),
    ttls: new Map(),
    expires: [],
    async incr(key) {
      const next = (redis.counts.get(key) ?? 0) + 1;
      redis.counts.set(key, next);
      return next;
    },
    async expire(key, seconds) {
      redis.expires.push([key, seconds]);
      redis.ttls.set(key, seconds);
      return 1;
    },
    async ttl(key) {
      return redis.ttls.get(key) ?? -1;
    },
    ...overrides,
  };
  return redis;
}

class TestRouter extends ConduitRouter {
  constructor(redis: unknown) {
    super({ redisManager: { getClient: () => redis } } as unknown as ConduitGrpcSdk);
  }
  protected _refreshRouter() {}
}

const route = {
  action: 'POST',
  path: '/limited',
  rateLimit: { maxRequests: 2, resetInterval: 3600 },
} as unknown as ConduitRouteOptions;

const KEY = 'limiter:route:POST:/limited:1.2.3.4';

function params(): ConduitRouteParameters {
  return { headers: {}, cookies: {}, context: {} } as unknown as ConduitRouteParameters;
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  assert.fail('expected the request to be rejected');
}

describe('per-route rate limit', () => {
  it('allows requests up to the limit and sets the window on the first one', async () => {
    const redis = fakeRedis();
    const router = new TestRouter(redis);
    await router.preHandle(route, params(), '1.2.3.4');
    await router.preHandle(route, params(), '1.2.3.4');
    assert.equal(redis.ttls.get('limiter:route:POST:/limited:1.2.3.4'), 3600);
  });

  it('rejects over the limit with 429 and the seconds left on the counter', async () => {
    const redis = fakeRedis();
    const router = new TestRouter(redis);
    await router.preHandle(route, params(), '1.2.3.4');
    await router.preHandle(route, params(), '1.2.3.4');
    redis.ttls.set('limiter:route:POST:/limited:1.2.3.4', 1234);
    const err = await rejection(router.preHandle(route, params(), '1.2.3.4'));
    assert.deepEqual(toErrorResponse(err), {
      name: 'RATE_LIMIT',
      status: 429,
      message: 'Too Many Requests',
      conduitCode: HermesErrorCodes.RATE_LIMIT_EXCEEDED,
    });
    assert.equal(retryAfterSeconds(err), 1234);
  });

  it('falls back to the window length when the TTL is unknown', async () => {
    const redis = fakeRedis({
      async ttl() {
        throw new Error('ttl failed');
      },
    });
    const router = new TestRouter(redis);
    await router.preHandle(route, params(), '1.2.3.4');
    await router.preHandle(route, params(), '1.2.3.4');
    const err = await rejection(router.preHandle(route, params(), '1.2.3.4'));
    assert.equal(retryAfterSeconds(err), 3600);
  });

  it('clips a window longer than the configured one, after the limit was shortened', async () => {
    const redis = fakeRedis();
    const router = new TestRouter(redis);
    await router.preHandle(route, params(), '1.2.3.4');
    await router.preHandle(route, params(), '1.2.3.4');
    redis.ttls.set(KEY, 3000);
    redis.expires.length = 0;
    const shortened = {
      ...route,
      rateLimit: { maxRequests: 2, resetInterval: 60 },
    } as ConduitRouteOptions;
    const err = await rejection(router.preHandle(shortened, params(), '1.2.3.4'));
    assert.deepEqual(redis.expires, [[KEY, 60]]);
    assert.equal(retryAfterSeconds(err), 60);
  });

  it('sets the missing expiry of a counter that has none', async () => {
    const redis = fakeRedis();
    const router = new TestRouter(redis);
    redis.counts.set(KEY, 2);
    const err = await rejection(router.preHandle(route, params(), '1.2.3.4'));
    assert.deepEqual(redis.expires, [[KEY, 3600]]);
    assert.equal(retryAfterSeconds(err), 3600);
  });

  it('does not touch the expiry of a counter within the window', async () => {
    const redis = fakeRedis();
    const router = new TestRouter(redis);
    await router.preHandle(route, params(), '1.2.3.4');
    await router.preHandle(route, params(), '1.2.3.4');
    redis.ttls.set(KEY, 3600);
    redis.expires.length = 0;
    const err = await rejection(router.preHandle(route, params(), '1.2.3.4'));
    assert.deepEqual(redis.expires, []);
    assert.equal(retryAfterSeconds(err), 3600);
  });

  it('answers 1 second when less than a second is left (TTL 0)', async () => {
    const redis = fakeRedis();
    const router = new TestRouter(redis);
    redis.counts.set(KEY, 2);
    redis.ttls.set(KEY, 0);
    const err = await rejection(router.preHandle(route, params(), '1.2.3.4'));
    assert.deepEqual(redis.expires, []);
    assert.equal(retryAfterSeconds(err), 1);
  });

  it('answers 1 second when the counter expired after the increment (TTL -2)', async () => {
    const redis = fakeRedis();
    const router = new TestRouter(redis);
    redis.counts.set(KEY, 2);
    redis.ttls.set(KEY, -2);
    const err = await rejection(router.preHandle(route, params(), '1.2.3.4'));
    assert.deepEqual(redis.expires, []);
    assert.equal(retryAfterSeconds(err), 1);
  });

  it('still rejects with the window length when clipping fails', async () => {
    const redis = fakeRedis();
    const router = new TestRouter(redis);
    redis.counts.set(KEY, 2);
    redis.expire = async () => {
      throw new Error('expire failed');
    };
    const err = await rejection(router.preHandle(route, params(), '1.2.3.4'));
    assert.ok(err instanceof RouteRateLimitError);
    assert.equal(retryAfterSeconds(err), 3600);
  });

  it('still rejects with RATE_LIMIT_UNAVAILABLE and no Retry-After when Redis fails', async () => {
    const redis = fakeRedis({
      async incr() {
        throw new Error('connection lost');
      },
    });
    const router = new TestRouter(redis);
    const err = await rejection(router.preHandle(route, params(), '1.2.3.4'));
    assert.deepEqual(toErrorResponse(err), {
      name: 'RATE_LIMIT',
      status: 429,
      message: 'Rate limit check unavailable',
      conduitCode: HermesErrorCodes.RATE_LIMIT_UNAVAILABLE,
    });
    assert.equal(retryAfterSeconds(err), undefined);
  });

  it('skips routes without a rate limit', async () => {
    const redis = fakeRedis();
    const router = new TestRouter(redis);
    const open = { ...route, rateLimit: undefined } as ConduitRouteOptions;
    for (let i = 0; i < 5; i++) await router.preHandle(open, params(), '1.2.3.4');
    assert.equal(redis.counts.size, 0);
  });
});

describe('retryAfterSeconds', () => {
  it('returns whole positive seconds only', () => {
    assert.equal(retryAfterSeconds({ retryAfterSeconds: 2.2 }), 3);
    assert.equal(retryAfterSeconds({ retryAfterSeconds: 0 }), undefined);
    assert.equal(retryAfterSeconds(new Error('x')), undefined);
    assert.equal(retryAfterSeconds(null), undefined);
  });
});

describe('REST rate limit response', () => {
  function fakeResponse() {
    const res = {
      headers: {} as Record<string, string>,
      statusCode: 0,
      body: undefined as unknown,
      setHeader(name: string, value: string) {
        res.headers[name] = value;
      },
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json(body: unknown) {
        res.body = body;
        return res;
      },
    };
    return res;
  }

  it('sends Retry-After with a per-route 429', () => {
    const res = fakeResponse();
    RestController.prototype.handleError.call(
      {},
      res as never,
    )(new RouteRateLimitError(42));
    assert.equal(res.statusCode, 429);
    assert.equal(res.headers['Retry-After'], '42');
    assert.equal(
      (res.body as { conduitCode?: string }).conduitCode,
      'RATE_LIMIT_EXCEEDED',
    );
  });

  it('sends no Retry-After for other errors', () => {
    const res = fakeResponse();
    RestController.prototype.handleError.call(
      {},
      res as never,
    )(new ConduitError('NOT_FOUND', 404, 'missing'));
    assert.equal(res.statusCode, 404);
    assert.equal(res.headers['Retry-After'], undefined);
  });
});
