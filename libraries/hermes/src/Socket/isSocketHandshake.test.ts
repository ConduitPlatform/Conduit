import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isSocketHandshake } from './isSocketHandshake.js';

describe('isSocketHandshake', () => {
  it('matches Engine.IO handshake query params only', () => {
    assert.equal(
      isSocketHandshake({ url: '/events/?EIO=4&transport=polling&t=abc' }),
      true,
    );
    assert.equal(
      isSocketHandshake({ url: '/realtime/?EIO=4&transport=websocket' }),
      true,
    );
  });

  it('rejects HTTP routes that merely mention realtime', () => {
    assert.equal(isSocketHandshake({ url: '/realtime/ticket' }), false);
    assert.equal(isSocketHandshake({ originalUrl: '/realtime' }), false);
    assert.equal(isSocketHandshake({ url: '/graphql?EIO=4' }), false);
  });
});
