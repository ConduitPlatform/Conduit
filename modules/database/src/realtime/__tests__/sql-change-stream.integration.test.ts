import { describe, expect, it } from '@jest/globals';
import sqlite3 from 'sqlite3';
import { normalizeChangeEvent } from '../normalize.js';
import { CHANGE_LOG_TABLE } from '../sql/constants.js';
import { createChangeLogTableSql } from '../sql/ddl.js';
import { toRawChangeEvent } from '../sql/mapEvent.js';
import { desiredTriggers } from '../sql/triggerSql.js';

function run(db: sqlite3.Database, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.exec(sql, err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function all<T>(db: sqlite3.Database, sql: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

describe('SQLite change-log contract', () => {
  it('captures insert/update/delete including raw SQL without document fields', async () => {
    const db = new sqlite3.Database(':memory:');
    try {
      await run(db, `CREATE TABLE "orders" (_id TEXT PRIMARY KEY, secret TEXT)`);
      await run(db, createChangeLogTableSql('sqlite'));
      for (const trigger of desiredTriggers('sqlite', 'orders')) {
        await run(db, trigger.sql);
      }
      await run(
        db,
        `INSERT INTO "orders" (_id, secret) VALUES ('order-1', 'do-not-leak')`,
      );
      await run(db, `UPDATE "orders" SET secret = 'still-secret' WHERE _id = 'order-1'`);
      await run(db, `DELETE FROM "orders" WHERE _id = 'order-1'`);
      const rows = await all<{
        id: number;
        collection_name: string;
        document_id: string;
        operation: string;
        occurred_at: string;
      }>(
        db,
        `SELECT id, collection_name, document_id, operation, occurred_at FROM "${CHANGE_LOG_TABLE}" ORDER BY id ASC`,
      );
      expect(rows.map(row => row.operation)).toEqual(['insert', 'update', 'delete']);
      const events = rows.map(row =>
        normalizeChangeEvent(
          toRawChangeEvent({
            id: String(row.id),
            collection_name: row.collection_name,
            document_id: row.document_id,
            operation: row.operation,
            occurred_at: row.occurred_at,
          }),
          'Order',
        ),
      );
      expect(events.map(event => event?.operation)).toEqual([
        'insert',
        'update',
        'delete',
      ]);
      for (const event of events) {
        expect(event).toMatchObject({ schema: 'Order', documentId: 'order-1' });
        expect(event).not.toHaveProperty('fullDocument');
        expect(JSON.stringify(event)).not.toContain('do-not-leak');
        expect(JSON.stringify(event)).not.toContain('still-secret');
      }
    } finally {
      await new Promise<void>(resolve => {
        db.close(() => resolve());
      });
    }
  });
});
