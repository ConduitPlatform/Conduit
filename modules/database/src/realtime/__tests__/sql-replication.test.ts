import { describe, expect, it, jest } from '@jest/globals';
import pg from 'pg';
import { PgoutputDecoder } from '../sql/pgoutput.js';
import { createPgoutputFeed } from '../sql/replication.js';
import type { ReplicationChange } from '../sql/replication.js';

describe('pgoutput CopyData fixture', () => {
  it('decodes a recorded XLogData insert after a relation message', () => {
    const decoder = new PgoutputDecoder();
    const relation = decoder.decodeMessage(
      encodeRelation(7, 'public', 'orders', ['_id', 'secret']),
    );
    expect(relation).toBeUndefined();
    const insert = decoder.decodeMessage(encodeInsert(7, ['order-1', 'do-not-leak']));
    expect(insert).toMatchObject({
      tag: 'insert',
      relation: { name: 'orders' },
      newRow: { _id: 'order-1', secret: 'do-not-leak' },
    });
  });

  it('starts a temp slot, speaks CopyData w/k, and emits a metadata-only change', async () => {
    const copyListeners: Array<(msg: { chunk: Buffer }) => void> = [];
    const fakeConnection = {
      on: (event: string, listener: (msg: { chunk: Buffer }) => void) => {
        if (event === 'copyData') copyListeners.push(listener);
      },
      sendCopyFromChunk: jest.fn(),
    };
    const connect = jest
      .spyOn(pg.Client.prototype, 'connect')
      .mockImplementation(async function (this: pg.Client) {
        Object.defineProperty(this, 'connection', {
          value: fakeConnection,
          configurable: true,
        });
      });
    const query = jest
      .spyOn(pg.Client.prototype, 'query')
      .mockImplementation((sql: unknown) => {
        const text = String(sql);
        if (text.includes('CREATE_REPLICATION_SLOT')) {
          return Promise.resolve({
            rows: [{ consistent_point: '0/16B3748' }],
          }) as never;
        }
        if (text.includes('START_REPLICATION')) {
          return new Promise(() => undefined) as never;
        }
        return Promise.reject(new Error(`unexpected query: ${text}`)) as never;
      });
    const end = jest.spyOn(pg.Client.prototype, 'end').mockResolvedValue(undefined);
    const feed = createPgoutputFeed({
      connectionUri: 'postgres://localhost/db',
      publicationName: 'cnd_realtime',
    });
    const changes: ReplicationChange[] = [];
    const errors: Error[] = [];
    feed.on('change', change => changes.push(change));
    feed.on('error', err => errors.push(err));
    try {
      await feed.start();
      expect(
        query.mock.calls.some(call =>
          String(call[0]).includes('CREATE_REPLICATION_SLOT'),
        ),
      ).toBe(true);
      expect(
        query.mock.calls.some(call => String(call[0]).includes('START_REPLICATION')),
      ).toBe(true);
      expect(copyListeners).toHaveLength(1);
      copyListeners[0]({
        chunk: xlogData(encodeRelation(7, 'public', 'orders', ['_id', 'secret'])),
      });
      copyListeners[0]({
        chunk: xlogData(encodeInsert(7, ['order-1', 'do-not-leak'])),
      });
      copyListeners[0]({ chunk: keepalive(0x16b3748n, true) });
      expect(errors).toEqual([]);
      expect(changes).toHaveLength(1);
      expect(changes[0]).toMatchObject({
        tag: 'insert',
        table: 'orders',
        newRow: { _id: 'order-1', secret: 'do-not-leak' },
      });
      expect(fakeConnection.sendCopyFromChunk).toHaveBeenCalled();
    } finally {
      await feed.stop();
      connect.mockRestore();
      query.mockRestore();
      end.mockRestore();
    }
  });

  it('emits error when CopyData is truncated', async () => {
    const copyListeners: Array<(msg: { chunk: Buffer }) => void> = [];
    const fakeConnection = {
      on: (event: string, listener: (msg: { chunk: Buffer }) => void) => {
        if (event === 'copyData') copyListeners.push(listener);
      },
      sendCopyFromChunk: jest.fn(),
    };
    const connect = jest
      .spyOn(pg.Client.prototype, 'connect')
      .mockImplementation(async function (this: pg.Client) {
        Object.defineProperty(this, 'connection', {
          value: fakeConnection,
          configurable: true,
        });
      });
    const query = jest
      .spyOn(pg.Client.prototype, 'query')
      .mockImplementation((sql: unknown) => {
        const text = String(sql);
        if (text.includes('CREATE_REPLICATION_SLOT')) {
          return Promise.resolve({
            rows: [{ consistent_point: '0/1' }],
          }) as never;
        }
        return new Promise(() => undefined) as never;
      });
    const end = jest.spyOn(pg.Client.prototype, 'end').mockResolvedValue(undefined);
    const feed = createPgoutputFeed({ connectionUri: 'postgres://localhost/db' });
    const errors: Error[] = [];
    feed.on('error', err => errors.push(err));
    try {
      await feed.start();
      copyListeners[0]({
        chunk: Buffer.concat([Buffer.from('w'), Buffer.alloc(24), Buffer.from('B')]),
      });
      expect(errors[0]?.message).toMatch(/underflow/);
    } finally {
      await feed.stop();
      connect.mockRestore();
      query.mockRestore();
      end.mockRestore();
    }
  });
});

function xlogData(payload: Buffer, walStart = 0x16b3748n): Buffer {
  const buf = Buffer.alloc(25 + payload.length);
  buf[0] = 'w'.charCodeAt(0);
  buf.writeBigUInt64BE(walStart, 1);
  buf.writeBigUInt64BE(walStart, 9);
  buf.writeBigInt64BE(0n, 17);
  payload.copy(buf, 25);
  return buf;
}

function keepalive(walEnd: bigint, replyRequested: boolean): Buffer {
  const buf = Buffer.alloc(1 + 8 + 8 + 1);
  buf[0] = 'k'.charCodeAt(0);
  buf.writeBigUInt64BE(walEnd, 1);
  buf.writeBigInt64BE(0n, 9);
  buf[17] = replyRequested ? 1 : 0;
  return buf;
}

function encodeRelation(
  oid: number,
  schema: string,
  name: string,
  columns: string[],
): Buffer {
  const parts = [
    Buffer.from('R'),
    i32(oid),
    cstring(schema),
    cstring(name),
    Buffer.from([100]),
    i16(columns.length),
  ];
  for (const column of columns) {
    parts.push(Buffer.from([1]), cstring(column), i32(25), i32(-1));
  }
  return Buffer.concat(parts);
}

function encodeInsert(oid: number, values: string[]): Buffer {
  const parts = [Buffer.from('I'), i32(oid), Buffer.from('N'), i16(values.length)];
  for (const value of values) {
    const bytes = Buffer.from(value, 'utf8');
    parts.push(Buffer.from('t'), i32(bytes.length), bytes);
  }
  return Buffer.concat(parts);
}

function cstring(value: string): Buffer {
  return Buffer.concat([Buffer.from(value, 'utf8'), Buffer.from([0])]);
}

function i16(value: number): Buffer {
  const buf = Buffer.alloc(2);
  buf.writeInt16BE(value);
  return buf;
}

function i32(value: number): Buffer {
  const buf = Buffer.alloc(4);
  buf.writeInt32BE(value);
  return buf;
}
