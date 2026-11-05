import assert from 'node:assert/strict';
import { after, describe, it, mock } from 'node:test';
import { Redis } from 'ioredis';
import winston from 'winston';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ConduitRoutingController } from './index.js';

const fakeLogger = Object.assign(Object.create(console), {
  winston: winston.createLogger({ silent: true }),
});
mock.getter(ConduitGrpcSdk, 'Logger', () => fakeLogger);
const redis = new Redis({ lazyConnect: true, enableOfflineQueue: false });
redis.on('error', () => {});
const grpcSdk = {
  redisManager: { getClient: () => redis, getUnprefixedClient: () => redis, prefix: '' },
  bus: { subscribe: () => {} },
  waitForExistence: () => new Promise<void>(() => {}),
} as unknown as ConduitGrpcSdk;

describe('ConduitRoutingController local middleware / recovery check replay', () => {
  const controller = new ConduitRoutingController(0, 0, '', grpcSdk);
  const c = controller as any;
  const handler = async () => ({ a: 1 });
  const check = async () => true;

  after(() => {
    controller.stopRest();
    controller.stopSockets();
    (c.server as { close(): void }).close();
    redis.disconnect();
  });

  it('applies settings registered before init, and again after stop/init', () => {
    controller.registerLocalMiddleware('auth', handler);
    controller.setSocketRecoveryCheck(check);

    controller.initRest();
    controller.initSockets();
    assert.equal(c._restRouter._localMiddlewares.get('auth'), handler);
    assert.equal(c._socketRouter._localMiddlewares.get('auth'), handler);
    assert.equal(c._socketRouter.recoveryCheck, check);

    controller.stopRest();
    controller.stopSockets();
    controller.initRest();
    controller.initSockets();
    assert.equal(c._restRouter._localMiddlewares.get('auth'), handler);
    assert.equal(c._socketRouter._localMiddlewares.get('auth'), handler);
    assert.equal(c._socketRouter.recoveryCheck, check);
  });

  it('applies live registrations to running routers and honors unregister', () => {
    const other = async () => {};
    controller.registerLocalMiddleware('other', other);
    assert.equal(c._restRouter._localMiddlewares.get('other'), other);
    controller.unregisterLocalMiddleware('other');
    assert.equal(c._restRouter._localMiddlewares.has('other'), false);
    assert.equal(c._socketRouter._localMiddlewares.has('other'), false);
    const check2 = async () => false;
    controller.setSocketRecoveryCheck(check2);
    assert.equal(c._socketRouter.recoveryCheck, check2);
  });
});
