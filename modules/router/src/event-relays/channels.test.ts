import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { groupRelaysByChannel, planChannelSubscriptions } from './channels.js';

describe('groupRelaysByChannel', () => {
  it('groups multiple relays onto the same exact channel', () => {
    const grouped = groupRelaysByChannel([
      { _id: 'a', busEvent: 'orders.paid' },
      { _id: 'b', busEvent: 'orders.paid' },
      { _id: 'c', busEvent: 'orders.shipped' },
    ]);
    assert.equal(grouped.get('orders.paid')?.length, 2);
    assert.equal(grouped.get('orders.shipped')?.length, 1);
  });
});

describe('planChannelSubscriptions', () => {
  it('subscribes new channels and unsubscribes removed ones', () => {
    const plan = planChannelSubscriptions(
      ['orders.paid', 'stale.channel'],
      ['orders.paid', 'orders.shipped'],
    );
    assert.deepEqual(plan.toSubscribe, ['orders.shipped']);
    assert.deepEqual(plan.toUnsubscribe, ['stale.channel']);
  });

  it('is a no-op when the channel set is unchanged', () => {
    const plan = planChannelSubscriptions(['orders.paid'], ['orders.paid']);
    assert.deepEqual(plan.toSubscribe, []);
    assert.deepEqual(plan.toUnsubscribe, []);
  });
});
