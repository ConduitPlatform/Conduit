import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSocketHandshake } from './handshake.js';

describe('isSocketHandshake', () => {
  it('detects Socket.IO engine requests', () => {
    assert.equal(isSocketHandshake({ url: '/realtime/?EIO=4&transport=polling' }), true);
    assert.equal(isSocketHandshake({ originalUrl: '/realtime' }), true);
    assert.equal(isSocketHandshake({ path: '/login' }), false);
    assert.equal(isSocketHandshake({ url: '/graphql' }), false);
  });
});
