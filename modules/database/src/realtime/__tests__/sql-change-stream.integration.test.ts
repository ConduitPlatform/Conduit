import { describe, expect, it } from '@jest/globals';
import sqlite3 from 'sqlite3';
import { Sequelize } from 'sequelize';
import { normalizeChangeEvent } from '../normalize.js';
import { CHANGE_LOG_TABLE } from '../sql/constants.js';
import { createChangeLogTableSql } from '../sql/ddl.js';
import { toRawChangeEvent } from '../sql/mapEvent.js';
import { desiredTriggers } from '../sql/triggerSql.js';
import { ensureChangeLog, fetchChangeLogBatch, trimChangeLog } from '../sql/changelog.js';
import { syncTriggers } from '../sql/triggers.js';
import { SqlChangeStream } from '../sql/SqlChangeStream.js';

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

  it('uses the physical primary key for custom-PK tables', async () => {
    const db = new sqlite3.Database(':memory:');
    try {
      await run(db, `CREATE TABLE "orders" (sku TEXT PRIMARY KEY, secret TEXT)`);
      await run(db, createChangeLogTableSql('sqlite'));
      for (const trigger of desiredTriggers('sqlite', 'orders', 'sku')) {
        await run(db, trigger.sql);
      }
      await run(db, `INSERT INTO "orders" (sku, secret) VALUES ('sku-1', 'hidden')`);
      const rows = await all<{ document_id: string }>(
        db,
        `SELECT document_id FROM "${CHANGE_LOG_TABLE}"`,
      );
      expect(rows).toEqual([{ document_id: 'sku-1' }]);
    } finally {
      await new Promise<void>(resolve => {
        db.close(() => resolve());
      });
    }
  });

  it('skips NULL document ids without aborting the user write', async () => {
    const db = new sqlite3.Database(':memory:');
    try {
      await run(db, `CREATE TABLE "orders" (_id TEXT, secret TEXT)`);
      await run(db, createChangeLogTableSql('sqlite'));
      for (const trigger of desiredTriggers('sqlite', 'orders')) {
        await run(db, trigger.sql);
      }
      await run(db, `INSERT INTO "orders" (_id, secret) VALUES (NULL, 'ok')`);
      const orders = await all<{ secret: string }>(db, `SELECT secret FROM "orders"`);
      const log = await all<{ id: number }>(db, `SELECT id FROM "${CHANGE_LOG_TABLE}"`);
      expect(orders).toEqual([{ secret: 'ok' }]);
      expect(log).toEqual([]);
    } finally {
      await new Promise<void>(resolve => {
        db.close(() => resolve());
      });
    }
  });

  it('drops triggers on opt-out without breaking DML', async () => {
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    try {
      await sequelize.query(`CREATE TABLE "orders" (_id TEXT PRIMARY KEY, secret TEXT)`);
      await ensureChangeLog(sequelize);
      await syncTriggers(sequelize, [
        {
          name: 'Order',
          collectionName: 'orders',
          authorizationEnabled: false,
          documentIdField: '_id',
        },
      ]);
      await sequelize.query(`INSERT INTO "orders" (_id, secret) VALUES ('order-1', 'x')`);
      expect((await fetchChangeLogBatch(sequelize, '0', 200, 0)).length).toBe(1);
      await syncTriggers(sequelize, []);
      await sequelize.query(`INSERT INTO "orders" (_id, secret) VALUES ('order-2', 'y')`);
      expect((await fetchChangeLogBatch(sequelize, '0', 200, 0)).length).toBe(1);
    } finally {
      await sequelize.close();
    }
  });

  it('leaves an existing same-name trigger in place on reconcile', async () => {
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    try {
      await sequelize.query(`CREATE TABLE "orders" (_id TEXT PRIMARY KEY, secret TEXT)`);
      await ensureChangeLog(sequelize);
      const schemas = [
        {
          name: 'Order',
          collectionName: 'orders',
          authorizationEnabled: false,
          documentIdField: '_id',
        },
      ];
      await syncTriggers(sequelize, schemas);
      const before = await sequelize.query(
        `SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'cnd_rt_%' ORDER BY name`,
        { raw: true },
      );
      await syncTriggers(sequelize, schemas);
      const after = await sequelize.query(
        `SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'cnd_rt_%' ORDER BY name`,
        { raw: true },
      );
      expect(after).toEqual(before);
    } finally {
      await sequelize.close();
    }
  });

  it('trims acked ids and starts SqlChangeStream from the enable watermark', async () => {
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    try {
      await ensureChangeLog(sequelize);
      await sequelize.query(
        `INSERT INTO "${CHANGE_LOG_TABLE}" (collection_name, document_id, operation, occurred_at)
         VALUES ('orders', 'old', 'insert', datetime('now'))`,
      );
      await trimChangeLog(sequelize, '1');
      expect(await fetchChangeLogBatch(sequelize, '0', 200, 0)).toEqual([]);
      await sequelize.query(
        `INSERT INTO "${CHANGE_LOG_TABLE}" (collection_name, document_id, operation, occurred_at)
         VALUES ('orders', 'new', 'insert', datetime('now'))`,
      );
      const received: unknown[] = [];
      const stream = new SqlChangeStream({
        sequelize,
        connectionUri: 'sqlite::memory:',
        defaultCursor: '1',
      });
      stream.on('change', change => {
        received.push(change);
      });
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        operationType: 'insert',
        documentKey: { _id: 'new' },
      });
      await stream.close();
    } finally {
      await sequelize.close();
    }
  });
});
