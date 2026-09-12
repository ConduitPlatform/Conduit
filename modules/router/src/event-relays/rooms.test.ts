import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { eventRelayRoom } from './rooms.js';

describe('eventRelayRoom', () => {
  it('is deterministic for the same relay and resource', () => {
    assert.equal(
      eventRelayRoom('relay-1', 'resource-a'),
      eventRelayRoom('relay-1', 'resource-a'),
    );
  });

  it('changes when the resource or relay changes', () => {
    assert.notEqual(
      eventRelayRoom('relay-1', 'resource-a'),
      eventRelayRoom('relay-1', 'resource-b'),
    );
    assert.notEqual(
      eventRelayRoom('relay-1', 'resource-a'),
      eventRelayRoom('relay-2', 'resource-a'),
    );
  });

  it('does not embed the raw resource id', () => {
    const room = eventRelayRoom('relay-1', 'secret-resource');
    assert.equal(room.includes('secret-resource'), false);
    assert.match(room, /^er:relay-1:[a-f0-9]{64}$/);
  });
});
