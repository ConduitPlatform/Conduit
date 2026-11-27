import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import convict from 'convict';
import AppConfigSchema from '../config/config.js';
import {
  STORAGE_WRITE,
  storageRateLimitConfigError,
  storageWriteRateLimit,
} from './routeRateLimits.js';

describe('storage write rate limit', () => {
  it('defaults to 60 requests per 3600 seconds', () => {
    const config = convict(AppConfigSchema).getProperties();
    assert.deepEqual(config.rateLimits.write, { maxRequests: 60, resetInterval: 3600 });
    assert.deepEqual(storageWriteRateLimit(config), STORAGE_WRITE);
  });

  it('uses the configured values', () => {
    assert.deepEqual(
      storageWriteRateLimit({
        rateLimits: { write: { maxRequests: 500, resetInterval: 60 } },
      }),
      { maxRequests: 500, resetInterval: 60 },
    );
  });

  it('falls back per field when a value is missing or invalid', () => {
    assert.deepEqual(storageWriteRateLimit({}), STORAGE_WRITE);
    assert.deepEqual(
      storageWriteRateLimit({
        rateLimits: { write: { maxRequests: 0, resetInterval: 120 } },
      }),
      { maxRequests: 60, resetInterval: 120 },
    );
    assert.deepEqual(
      storageWriteRateLimit({
        rateLimits: { write: { maxRequests: 10, resetInterval: 1.5 } },
      }),
      { maxRequests: 10, resetInterval: 3600 },
    );
  });
});

describe('storage rate limit config validation', () => {
  it('accepts updates without rate limits or with positive integers', () => {
    assert.equal(storageRateLimitConfigError(undefined), null);
    assert.equal(storageRateLimitConfigError({}), null);
    assert.equal(storageRateLimitConfigError({ write: { maxRequests: 1 } }), null);
    assert.equal(
      storageRateLimitConfigError({ write: { maxRequests: 200, resetInterval: 3600 } }),
      null,
    );
  });

  it('rejects values that are not positive integers', () => {
    for (const value of [0, -1, 1.5, '60', null, Number.NaN]) {
      assert.equal(
        storageRateLimitConfigError({ write: { maxRequests: value } }),
        'rateLimits.write.maxRequests must be a positive integer',
      );
      assert.equal(
        storageRateLimitConfigError({ write: { resetInterval: value } }),
        'rateLimits.write.resetInterval must be a positive integer',
      );
    }
  });

  it('rejects a malformed rateLimits object', () => {
    assert.equal(storageRateLimitConfigError(5), 'rateLimits must be an object');
    assert.equal(
      storageRateLimitConfigError({ write: [] }),
      'rateLimits.write must be an object',
    );
  });
});
