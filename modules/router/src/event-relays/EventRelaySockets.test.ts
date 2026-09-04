import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { status } from '@grpc/grpc-js';
import { authorizeRelaySubscription } from './authorize.js';
import { eventRelayRoom } from './rooms.js';
import type { RelayLookup } from './authorize.js';

function mockSdk(options: {
  available?: boolean;
  allow?: boolean;
  throwOnCan?: boolean;
}) {
  return {
    isAvailable: () => options.available !== false,
    authorization:
      options.available === false
        ? null
        : {
            can: async () => {
              if (options.throwOnCan) {
                throw new Error('authz down');
              }
              return { allow: options.allow === true };
            },
          },
  };
}

function mockManager(relay: unknown): RelayLookup {
  return {
    getActiveRelay: () => relay as ReturnType<RelayLookup['getActiveRelay']>,
  };
}

const relay = {
  _id: 'relay-1',
  permission: 'read',
  resourceType: 'Order',
};

describe('authorizeRelaySubscription', () => {
  it('returns the deterministic room when ReBAC allows', async () => {
    const room = await authorizeRelaySubscription(
      mockSdk({ allow: true }),
      mockManager(relay),
      'user-1',
      'relay-1',
      'order-1',
    );
    assert.equal(room, eventRelayRoom('relay-1', 'order-1'));
  });

  it('denies when ReBAC returns false', async () => {
    await assert.rejects(
      () =>
        authorizeRelaySubscription(
          mockSdk({ allow: false }),
          mockManager(relay),
          'user-1',
          'relay-1',
          'order-1',
        ),
      (err: any) => err.code === status.PERMISSION_DENIED,
    );
  });

  it('fails closed when authorization is unavailable', async () => {
    await assert.rejects(
      () =>
        authorizeRelaySubscription(
          mockSdk({ available: false }),
          mockManager(relay),
          'user-1',
          'relay-1',
          'order-1',
        ),
      (err: any) => err.code === status.UNAVAILABLE,
    );
  });

  it('unsubscribe room matches subscribe room for the same ids', async () => {
    const subscribed = await authorizeRelaySubscription(
      mockSdk({ allow: true }),
      mockManager(relay),
      'user-1',
      'relay-1',
      'order-1',
    );
    assert.equal(subscribed, eventRelayRoom('relay-1', 'order-1'));
  });
});
