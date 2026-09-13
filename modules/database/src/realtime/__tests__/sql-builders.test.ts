import { describe, expect, it } from '@jest/globals';
import { normalizeChangeEvent } from '../normalize.js';
import {
  createPublicationSql,
  addPublicationTableSql,
  dropPublicationTableSql,
  replicaIdentityFullSql,
} from '../sql/publication.js';
import { PUBLICATION_NAME } from '../sql/constants.js';
import { quoteIdent, quoteQualified } from '../sql/identifiers.js';
import { documentIdFromChange, toRawChangeEvent } from '../sql/mapEvent.js';
import {
  PgoutputDecoder,
  formatLsn,
  parseLsn,
  postgresTimeToDate,
} from '../sql/pgoutput.js';

describe('PostgreSQL WAL publication SQL', () => {
  it('creates a pgoutput publication for DML only', () => {
    const sql = createPublicationSql();
    expect(sql).toContain(quoteIdent(PUBLICATION_NAME));
    expect(sql).toContain("publish = 'insert,update,delete'");
    expect(sql).not.toMatch(/TRIGGER|_cnd_DatabaseChange|pg_notify|LISTEN/i);
  });

  it('adds and drops qualified tables', () => {
    expect(addPublicationTableSql(PUBLICATION_NAME, 'public', 'orders')).toBe(
      `ALTER PUBLICATION ${quoteIdent(PUBLICATION_NAME)} ADD TABLE ${quoteQualified(
        'public',
        'orders',
      )}`,
    );
    expect(dropPublicationTableSql(PUBLICATION_NAME, 'public', 'orders')).toContain(
      'DROP TABLE',
    );
    expect(replicaIdentityFullSql('public', 'orders')).toBe(
      `ALTER TABLE ${quoteQualified('public', 'orders')} REPLICA IDENTITY FULL`,
    );
  });
});

describe('pgoutput decoder', () => {
  it('decodes relation + insert/update/delete without leaking extra columns into the mapped id', () => {
    const decoder = new PgoutputDecoder();
    expect(
      decoder.decodeMessage(encodeRelation(42, 'public', 'orders', ['_id', 'secret'])),
    ).toBeUndefined();
    const insert = decoder.decodeMessage(encodeInsert(42, ['order-1', 'do-not-leak']));
    expect(insert).toMatchObject({
      tag: 'insert',
      relation: { name: 'orders' },
      newRow: { _id: 'order-1', secret: 'do-not-leak' },
    });
    const update = decoder.decodeMessage(
      encodeUpdate(42, ['order-1'], ['order-1', 'still-secret']),
    );
    expect(update?.tag).toBe('update');
    expect(update && 'newRow' in update ? update.newRow : undefined).toMatchObject({
      _id: 'order-1',
      secret: 'still-secret',
    });
    const del = decoder.decodeMessage(encodeDelete(42, ['order-1']));
    expect(del?.tag).toBe('delete');
    expect(documentIdFromChange(del!)).toBe('order-1');
    expect(documentIdFromChange(insert!, 'sku')).toBeUndefined();
  });

  it('decodes begin commit timestamps from the postgres epoch', () => {
    const decoder = new PgoutputDecoder();
    const micros = 1_000_000n;
    const begin = decoder.decodeMessage(encodeBegin(0x10n, micros, 9));
    expect(begin).toMatchObject({ tag: 'begin', xid: 9 });
    expect(begin && 'commitTime' in begin ? begin.commitTime : undefined).toEqual(
      postgresTimeToDate(micros),
    );
  });

  it('round-trips LSN formatting', () => {
    expect(formatLsn(parseLsn('0/16B3748'))).toBe('0/016B3748');
  });
});

describe('WAL event mapping', () => {
  it('maps metadata-only change events and uses a custom PK', () => {
    const raw = toRawChangeEvent({
      operation: 'insert',
      table: 'orders',
      documentId: 'sku-1',
      lsn: '0/1:1:1',
      occurredAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    const event = normalizeChangeEvent(raw, 'Order');
    expect(event).toMatchObject({
      operation: 'insert',
      schema: 'Order',
      documentId: 'sku-1',
    });
    expect(event).not.toHaveProperty('fullDocument');
    expect(
      documentIdFromChange(
        {
          tag: 'insert',
          newRow: { sku: 'sku-1', secret: 'hidden' },
        },
        'sku',
      ),
    ).toBe('sku-1');
  });
});

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

function encodeInsert(oid: number, values: (string | null)[]): Buffer {
  return Buffer.concat([
    Buffer.from('I'),
    i32(oid),
    Buffer.from('N'),
    encodeTuple(values),
  ]);
}

function encodeUpdate(
  oid: number,
  key: (string | null)[],
  values: (string | null)[],
): Buffer {
  return Buffer.concat([
    Buffer.from('U'),
    i32(oid),
    Buffer.from('K'),
    encodeTuple(key),
    Buffer.from('N'),
    encodeTuple(values),
  ]);
}

function encodeDelete(oid: number, key: (string | null)[]): Buffer {
  return Buffer.concat([Buffer.from('D'), i32(oid), Buffer.from('K'), encodeTuple(key)]);
}

function encodeBegin(finalLsn: bigint, micros: bigint, xid: number): Buffer {
  const buf = Buffer.alloc(1 + 8 + 8 + 4);
  buf[0] = 'B'.charCodeAt(0);
  buf.writeBigUInt64BE(finalLsn, 1);
  buf.writeBigInt64BE(micros, 9);
  buf.writeInt32BE(xid, 17);
  return buf;
}

function encodeTuple(values: (string | null)[]): Buffer {
  const parts = [i16(values.length)];
  for (const value of values) {
    if (value == null) {
      parts.push(Buffer.from('n'));
      continue;
    }
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
