import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  releaseSocketSubscriptions,
  removeSubscriptionsForRelay,
  subscriptionsForRecoveredRooms,
  subscriptionsForUser,
  trackSubscription,
  _clearEventRelaySubscriptionStateForTests,
} from './subscriptions.js';
import { eventRelayRoom } from './rooms.js';
import { reauthorizeRecoveredSubscriptions } from './recovery.js';
import { RelayLookup } from './authorize.js';

describe('event relay subscription tracking', () => {
  it('clears user map entries when the only socket disconnects', () => {
    _clearEventRelaySubscriptionStateForTests();
    trackSubscription('socket-a', 'user-1', 'relay-1', 'order-1');
    releaseSocketSubscriptions('socket-a', 'user-1');
    assert.deepEqual(subscriptionsForUser('user-1'), []);
  });

  it('keeps user map entries when another socket still holds the subscription', () => {
    _clearEventRelaySubscriptionStateForTests();
    trackSubscription('socket-a', 'user-1', 'relay-1', 'order-1');
    trackSubscription('socket-b', 'user-1', 'relay-1', 'order-1');
    releaseSocketSubscriptions('socket-a', 'user-1');
    assert.deepEqual(subscriptionsForUser('user-1'), [
      { relayId: 'relay-1', resourceId: 'order-1' },
    ]);
  });

  it('clears relay subscriptions on eviction', () => {
    _clearEventRelaySubscriptionStateForTests();
    trackSubscription('socket-a', 'user-1', 'relay-1', 'order-1');
    removeSubscriptionsForRelay('relay-1');
    assert.deepEqual(subscriptionsForUser('user-1'), []);
  });
});

describe('recovery re-authorization', () => {
  const room = eventRelayRoom('relay-1', 'order-1');
  const relay = {
    _id: 'relay-1',
    permission: 'read',
    resourceType: 'Order',
  };

  it('keeps restored rooms when Authorization is unavailable', async () => {
    _clearEventRelaySubscriptionStateForTests();
    trackSubscription('old-socket', 'user-1', 'relay-1', 'order-1');
    releaseSocketSubscriptions('old-socket', 'user-1');

    const manager = {
      getActiveRelay: (id: string) => (id === 'relay-1' ? relay : undefined),
    } as unknown as RelayLookup;

    const grpcSdk = {
      isAvailable: () => false,
      authorization: null,
    };

    const result = await reauthorizeRecoveredSubscriptions(grpcSdk, manager, {
      socketId: 'new-socket',
      context: {
        user: { _id: 'user-1' },
        eventRelaySubs: [{ relayId: 'relay-1', resourceId: 'order-1' }],
      },
      recoveredRooms: [room],
    });

    assert.deepEqual(result, { event: 'join-room', rooms: [] });
    assert.deepEqual(subscriptionsForUser('user-1'), [
      { relayId: 'relay-1', resourceId: 'order-1' },
    ]);
  });

  it('leaves restored rooms on permission deny', async () => {
    _clearEventRelaySubscriptionStateForTests();
    trackSubscription('old-socket', 'user-1', 'relay-1', 'order-1');
    releaseSocketSubscriptions('old-socket', 'user-1');

    const manager = {
      getActiveRelay: (id: string) => (id === 'relay-1' ? relay : undefined),
    } as unknown as RelayLookup;

    const grpcSdk = {
      isAvailable: () => true,
      authorization: {
        can: async () => ({ allow: false }),
      },
    };

    const result = await reauthorizeRecoveredSubscriptions(grpcSdk, manager, {
      socketId: 'new-socket',
      context: {
        user: { _id: 'user-1' },
        eventRelaySubs: [{ relayId: 'relay-1', resourceId: 'order-1' }],
      },
      recoveredRooms: [room],
    });

    assert.deepEqual(result, { event: 'leave-room', rooms: [room] });
    assert.deepEqual(subscriptionsForUser('user-1'), []);
  });

  it('does not re-auth rooms outside the recovered socket session', async () => {
    _clearEventRelaySubscriptionStateForTests();
    trackSubscription('old-socket', 'user-1', 'relay-1', 'order-1');
    trackSubscription('old-socket', 'user-1', 'relay-2', 'order-2');
    releaseSocketSubscriptions('old-socket', 'user-1');

    const manager = {
      getActiveRelay: (id: string) =>
        id === 'relay-2'
          ? { _id: 'relay-2', permission: 'read', resourceType: 'Order' }
          : undefined,
    } as unknown as RelayLookup;

    let canCalls = 0;
    const grpcSdk = {
      isAvailable: () => true,
      authorization: {
        can: async () => {
          canCalls++;
          return { allow: false };
        },
      },
    };

    const otherRoom = eventRelayRoom('relay-2', 'order-2');
    await reauthorizeRecoveredSubscriptions(grpcSdk, manager, {
      socketId: 'new-socket',
      context: {
        user: { _id: 'user-1' },
        eventRelaySubs: [{ relayId: 'relay-2', resourceId: 'order-2' }],
      },
      recoveredRooms: [otherRoom],
    });

    assert.equal(canCalls, 1);
    assert.deepEqual(subscriptionsForUser('user-1'), []);
  });

  it('re-auths the first user after a second user subscribed to the same room', async () => {
    _clearEventRelaySubscriptionStateForTests();
    trackSubscription('socket-a', 'user-a', 'relay-1', 'order-1');
    trackSubscription('socket-b', 'user-b', 'relay-1', 'order-1');
    releaseSocketSubscriptions('socket-b', 'user-b');

    let checkedSubject = '';
    const manager = {
      getActiveRelay: (id: string) => (id === 'relay-1' ? relay : undefined),
    } as unknown as RelayLookup;
    const grpcSdk = {
      isAvailable: () => true,
      authorization: {
        can: async (request: { subject: string }) => {
          checkedSubject = request.subject;
          return { allow: true };
        },
      },
    };

    await reauthorizeRecoveredSubscriptions(grpcSdk, manager, {
      socketId: 'socket-a-new',
      context: { user: { _id: 'user-a' } },
      recoveredRooms: [room],
    });

    assert.equal(checkedSubject, 'User:user-a');
  });

  it('prefers socket.data subscriptions when the room map was pruned on disconnect', () => {
    _clearEventRelaySubscriptionStateForTests();
    trackSubscription('socket-a', 'user-a', 'relay-1', 'order-1');
    releaseSocketSubscriptions('socket-a', 'user-a');
    assert.deepEqual(subscriptionsForRecoveredRooms([room]), []);
    assert.deepEqual(
      subscriptionsForRecoveredRooms([room], [
        { relayId: 'relay-1', resourceId: 'order-1' },
      ]),
      [{ relayId: 'relay-1', resourceId: 'order-1' }],
    );
  });
});
