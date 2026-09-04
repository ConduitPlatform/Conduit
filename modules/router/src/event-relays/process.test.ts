import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildRelayEmissions, parseBusPayload } from './process.js';
import { createEventRelayPusher } from './push.js';
import { eventRelayRoom } from './rooms.js';
import { EVENTS_NAMESPACE } from './constants.js';

const relayA = {
  _id: 'relay-a',
  busEvent: 'database:update:Order',
  socketEvent: 'order-updated',
  resourceIdPath: '_id',
  messageTemplate: { id: '{{payload._id}}', status: '{{payload.status}}' },
};

const relayB = {
  _id: 'relay-b',
  busEvent: 'database:update:Order',
  socketEvent: 'order-paid',
  resourceIdPath: '_id',
  messageTemplate: { paid: '{{payload.status}}' },
};

describe('parseBusPayload', () => {
  it('parses JSON once', () => {
    assert.deepEqual(parseBusPayload('{"_id":"1"}'), { _id: '1' });
  });

  it('fails closed on malformed JSON', () => {
    assert.throws(() => parseBusPayload('{'), { name: 'EventRelayValidationError' });
    assert.throws(() => parseBusPayload(''), { name: 'EventRelayValidationError' });
  });
});

describe('buildRelayEmissions', () => {
  it('emits to every mapping on the same channel', () => {
    const result = buildRelayEmissions([relayA, relayB], {
      _id: 'order-1',
      status: 'paid',
    });
    assert.equal(result.failures.length, 0);
    assert.equal(result.emissions.length, 2);
    assert.deepEqual(
      result.emissions.map(item => item.socketEvent),
      ['order-updated', 'order-paid'],
    );
    assert.equal(result.emissions[0].room, eventRelayRoom('relay-a', 'order-1'));
  });

  it('records per-relay failures without dropping siblings', () => {
    const result = buildRelayEmissions(
      [
        relayA,
        {
          ...relayB,
          resourceIdPath: 'missing',
        },
      ],
      { _id: 'order-1', status: 'paid' },
    );
    assert.equal(result.emissions.length, 1);
    assert.equal(result.failures.length, 1);
    assert.equal(result.failures[0].relayId, 'relay-b');
  });
});

describe('createEventRelayPusher', () => {
  it('pushes locally to /events/ rooms so HA instances do not duplicate', async () => {
    const calls: unknown[] = [];
    const push = createEventRelayPusher(async data => {
      calls.push(data);
    });
    await push('order-updated', { id: '1' }, ['room-1']);
    assert.deepEqual(calls, [
      {
        event: 'order-updated',
        data: { id: '1' },
        receivers: [],
        rooms: ['room-1'],
        namespace: EVENTS_NAMESPACE,
        localOnly: true,
      },
    ]);
  });
});
