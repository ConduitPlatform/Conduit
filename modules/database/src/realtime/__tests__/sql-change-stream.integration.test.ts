import { EventEmitter } from 'node:events';
import { describe, expect, it } from '@jest/globals';
import { normalizeChangeEvent } from '../normalize.js';
import { SqlChangeStream } from '../sql/SqlChangeStream.js';
import type { ReplicationChange, ReplicationFeed } from '../sql/replication.js';

describe('SqlChangeStream WAL contract', () => {
  it('captures insert/update/delete without document fields', async () => {
    const feed = new FakeFeed();
    const stream = new SqlChangeStream({
      connectionUri: 'postgres://localhost/db',
      idFieldByTable: { orders: '_id' },
      createFeed: () => feed,
    });
    const received: unknown[] = [];
    stream.on('change', change => received.push(change));
    await stream.ready;
    feed.push(row('insert', 'order-1', 'do-not-leak'));
    feed.push(row('update', 'order-1', 'still-secret'));
    feed.push({
      tag: 'delete',
      table: 'orders',
      keyRow: { _id: 'order-1' },
      lsn: '0/3:1:3',
      occurredAt: new Date('2026-03-01T00:00:03.000Z'),
    });
    const events = (received as Parameters<typeof normalizeChangeEvent>[0][]).map(
      change => normalizeChangeEvent(change, 'Order'),
    );
    expect(events.map(event => event?.operation)).toEqual(['insert', 'update', 'delete']);
    for (const event of events) {
      expect(event).toMatchObject({ schema: 'Order', documentId: 'order-1' });
      expect(event).not.toHaveProperty('fullDocument');
      expect(JSON.stringify(event)).not.toContain('do-not-leak');
      expect(JSON.stringify(event)).not.toContain('still-secret');
    }
    await stream.close();
  });
});

const logicalUri = process.env.SQL_LOGICAL_URI;
const describeLivePgoutput = logicalUri ? describe : describe.skip;

describeLivePgoutput(
  'SqlChangeStream live pgoutput (set SQL_LOGICAL_URI; skipped in CI)',
  () => {
    it('requires a Postgres URI with wal_level=logical', () => {
      expect(logicalUri).toMatch(/^postgres/);
    });
  },
);

function row(tag: 'insert' | 'update', id: string, secret: string): ReplicationChange {
  const seq = tag === 'insert' ? '1' : '2';
  return {
    tag,
    table: 'orders',
    newRow: { _id: id, secret },
    lsn: `0/${seq}:1:${seq}`,
    occurredAt: new Date(`2026-03-01T00:00:0${seq}.000Z`),
  };
}

class FakeFeed implements ReplicationFeed {
  readonly emitter = new EventEmitter();
  started = false;

  on(event: 'change', listener: (change: ReplicationChange) => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
  on(event: string, listener: (...args: never[]) => void): void {
    this.emitter.on(event, listener);
  }

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    return;
  }

  push(change: ReplicationChange): void {
    this.emitter.emit('change', change);
  }
}
