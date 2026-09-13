import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ADMIN_REALTIME_AUDIENCE,
  buildRealtimeTicketClaims,
  isRealtimeTicket,
} from './ticket.js';

describe('admin realtime tickets', () => {
  it('scopes claims to the realtime audience', () => {
    const claims = buildRealtimeTicketClaims('admin-1');
    assert.equal(claims.id, 'admin-1');
    assert.equal(claims.aud, ADMIN_REALTIME_AUDIENCE);
    assert.equal(isRealtimeTicket(claims), true);
  });

  it('rejects ordinary admin JWTs and missing payloads', () => {
    assert.equal(isRealtimeTicket({ id: 'admin-1' }), false);
    assert.equal(isRealtimeTicket({ id: 'admin-1', aud: 'other' }), false);
    assert.equal(isRealtimeTicket(null), false);
    assert.equal(
      isRealtimeTicket({ id: 'admin-1', aud: [ADMIN_REALTIME_AUDIENCE, 'extra'] }),
      true,
    );
  });
});
