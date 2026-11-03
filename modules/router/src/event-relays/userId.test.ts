import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { contextUserId } from './userId.js';
import { reauthorizeRecoveredSubscriptions } from './recovery.js';

describe('contextUserId', () => {
  it('reads userId (jwt mode) or user._id (session mode)', () => {
    assert.equal(contextUserId({ userId: 'u1' }), 'u1');
    assert.equal(contextUserId({ user: { _id: 'u2' } }), 'u2');
    assert.equal(contextUserId({ userId: 'u1', user: { _id: 'u2' } }), 'u1');
    assert.equal(contextUserId({}), undefined);
    assert.equal(contextUserId(undefined), undefined);
  });
  it('recovery does not leave rooms for a userId-only context', async () => {
    const res = await reauthorizeRecoveredSubscriptions({} as any, {} as any, {
      socketId: 's',
      context: { userId: 'u1' },
      recoveredRooms: [],
    });
    assert.equal(res.event, 'join-room');
  });
});
