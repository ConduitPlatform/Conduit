import assert from 'node:assert/strict';
import { before, beforeEach, describe, it } from 'node:test';
import { ConduitGrpcSdk, type IConduitLogger } from '@conduitplatform/grpc-sdk';
import type { CdnConfiguration } from './cdnConfigMigration.js';
import { syncCdnConfig } from './cdnConfigSync.js';

const errors: string[] = [];
let sdk: ConduitGrpcSdk;
let calls: CdnConfiguration[];

const previous: CdnConfiguration = { a: { host: 'https://a.example' } } as never;
const current: CdnConfiguration = { b: { host: 'https://b.example' } } as never;

before(() => {
  const logger = {
    log() {},
    error(message: string | Error) {
      errors.push(message instanceof Error ? message.message : message);
    },
  } as unknown as IConduitLogger;
  sdk = new ConduitGrpcSdk('127.0.0.1:55152', 'cdn-sync-test', false, logger);
});

beforeEach(() => {
  errors.length = 0;
  calls = [];
});

const okMigrate = async (_sdk: ConduitGrpcSdk, prev: CdnConfiguration) => {
  calls.push(prev);
};
const failMigrate = async (_sdk: ConduitGrpcSdk, prev: CdnConfiguration) => {
  calls.push(prev);
  throw new Error('db down');
};

describe('syncCdnConfig', () => {
  it('skips migration when configs are equal', async () => {
    const result = await syncCdnConfig(
      sdk,
      previous,
      { ...previous },
      { failOnError: true, migrate: okMigrate },
    );
    assert.equal(calls.length, 0);
    assert.equal(result, previous);
  });

  it('returns a copy of current after successful migration', async () => {
    const result = await syncCdnConfig(sdk, previous, current, {
      failOnError: true,
      migrate: okMigrate,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0], previous);
    assert.deepEqual(result, current);
    assert.notEqual(result, current);
  });

  it('rethrows on failure when failOnError is true', async () => {
    await assert.rejects(
      syncCdnConfig(sdk, previous, current, { failOnError: true, migrate: failMigrate }),
      /db down/,
    );
    assert.equal(calls.length, 1);
  });

  it('logs and keeps previous snapshot when failOnError is false', async () => {
    const result = await syncCdnConfig(sdk, previous, current, {
      failOnError: false,
      migrate: failMigrate,
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(result, previous);
    assert.equal(errors.length, 1);
    assert.match(errors[0], /CDN/);
    assert.match(errors[0], /retried/);
  });
});
