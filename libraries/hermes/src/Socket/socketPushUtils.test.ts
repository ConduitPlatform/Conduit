import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  filterRemoteSocketsByUserAndRooms,
  isEngineSocketBackpressured,
  WRITE_BUFFER_PACKET_HIGH_WATER,
} from './socketPushUtils.js';

describe('filterRemoteSocketsByUserAndRooms', () => {
  const roomA = 'er:relay-1:aaa';
  const roomB = 'er:relay-1:bbb';

  it('emits only to sockets in the target room for the same user', () => {
    const sockets = [
      {
        id: 'tab-a',
        data: { user: { _id: 'user-1' } },
        rooms: new Set([roomA]),
      },
      {
        id: 'tab-b',
        data: { user: { _id: 'user-1' } },
        rooms: new Set([roomB]),
      },
    ];

    const filtered = filterRemoteSocketsByUserAndRooms(sockets, ['user-1'], [roomA]);
    assert.deepEqual(
      filtered.map(s => s.id),
      ['tab-a'],
    );
  });
});

describe('isEngineSocketBackpressured', () => {
  it('uses writeBuffer queue depth only', () => {
    assert.equal(isEngineSocketBackpressured(undefined), false);
    assert.equal(
      isEngineSocketBackpressured({ writeBuffer: new Array(WRITE_BUFFER_PACKET_HIGH_WATER) }),
      false,
    );
    assert.equal(
      isEngineSocketBackpressured({
        writeBuffer: new Array(WRITE_BUFFER_PACKET_HIGH_WATER + 1),
      }),
      true,
    );
    assert.equal(
      isEngineSocketBackpressured({
        writeBuffer: [],
      }),
      false,
    );
  });
});

describe('SocketController relay emit', () => {
  it('does not reference writableLength or client emit ack callbacks', () => {
    const socketSource = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/Socket/Socket.ts'),
      'utf8',
    );
    assert.doesNotMatch(socketSource, /writableLength/);
    assert.doesNotMatch(socketSource, /\.emit\([^)]*,\s*[^,)]+,\s*\(\)\s*=>/);
  });
});
