import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  subscriptionsForUser,
  trackSubscription,
  removeSubscriptionsForRelay,
  _clearEventRelaySubscriptionStateForTests,
} from './subscriptions.js';

describe('event relay subscription tracking', () => {
  it('keeps user subscriptions after socket disconnect for recovery', () => {
    _clearEventRelaySubscriptionStateForTests();
    trackSubscription('socket-a', 'user-1', 'relay-1', 'order-1');
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
