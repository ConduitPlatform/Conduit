import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSocketHandshake } from '@conduitplatform/hermes';
import { buildRealtimeTicketClaims, isRealtimeTicket } from './ticket.js';

describe('realtime ticket HTTP guard', () => {
  it('does not treat POST /realtime/ticket as a handshake so a ticket cannot mint another', () => {
    const ticket = buildRealtimeTicketClaims('admin-1');
    assert.equal(isRealtimeTicket(ticket), true);
    assert.equal(isSocketHandshake({ url: '/realtime/ticket' }), false);
    assert.equal(
      isSocketHandshake({ url: '/realtime/ticket?EIO=4&transport=polling' }),
      false,
    );
    assert.equal(isRealtimeTicket(ticket) && !isSocketHandshake({ url: '/realtime/ticket' }), true);
  });

  it('allows a ticket on Engine.IO handshake polling without sid', () => {
    const ticket = buildRealtimeTicketClaims('admin-1');
    const handshake = { url: '/realtime/?EIO=4&transport=polling' };
    assert.equal(isSocketHandshake(handshake), true);
    assert.equal(isRealtimeTicket(ticket) && isSocketHandshake(handshake), true);
  });
});
