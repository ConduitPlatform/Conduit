import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RelayRebacCache } from './rebacCache.js';

describe('RelayRebacCache', () => {
  it('denies after TTL when authorization revokes access', async () => {
    let allow = true;
    const cache = new RelayRebacCache(10);
    const grpcSdk = {
      isAvailable: () => true,
      authorization: {
        can: async () => ({ allow }),
      },
    };
    assert.equal(
      await cache.can(grpcSdk as never, 'user-1', 'read', 'Order', 'order-1'),
      true,
    );
    allow = false;
    assert.equal(
      await cache.can(grpcSdk as never, 'user-1', 'read', 'Order', 'order-1'),
      true,
    );
    await new Promise(resolve => setTimeout(resolve, 15));
    assert.equal(
      await cache.can(grpcSdk as never, 'user-1', 'read', 'Order', 'order-1'),
      false,
    );
  });
});
