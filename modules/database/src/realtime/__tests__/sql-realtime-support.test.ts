import { EventEmitter } from 'node:events';
import { describe, expect, it, jest } from '@jest/globals';
import pg from 'pg';
import { QueryTypes, Sequelize } from 'sequelize';
import { SqlChangeStream } from '../sql/SqlChangeStream.js';
import { SqlRealtimeSupport } from '../sql/SqlRealtimeSupport.js';
import { LEGACY_CHANGE_LOG_TABLE, PUBLICATION_NAME } from '../sql/constants.js';
import { quoteIdent } from '../sql/identifiers.js';
import type { ReplicationChange, ReplicationFeed } from '../sql/replication.js';

describe('SqlRealtimeSupport', () => {
  it('reports mysql and sqlite as unsupported', async () => {
    for (const dialect of ['mysql', 'mariadb', 'sqlite'] as const) {
      const sequelize = {
        getDialect: () => dialect,
        query: async () => [],
      };
      const support = new SqlRealtimeSupport({
        sequelize,
        connectionUri: `${dialect}://localhost/db`,
      } as never);
      const result = await support.checkTopology();
      expect(result.supported).toBe(false);
      expect(result.message).toMatch(/PostgreSQL WAL CDC only/i);
    }
  });

  it('fails topology when wal_level is not logical', async () => {
    const support = new SqlRealtimeSupport({
      sequelize: {
        getDialect: () => 'postgres',
        query: async (sql: string) => {
          if (sql.includes('pg_settings')) {
            return [
              { name: 'wal_level', setting: 'replica' },
              { name: 'max_replication_slots', setting: '10' },
              { name: 'max_wal_senders', setting: '10' },
            ];
          }
          return [];
        },
      },
      connectionUri: 'postgres://localhost/db',
    } as never);
    const result = await support.checkTopology();
    expect(result.supported).toBe(false);
    expect(result.message).toMatch(/wal_level=logical/);
  });

  it('does not create a probe replication slot during topology checks', async () => {
    const connect = jest
      .spyOn(pg.Client.prototype, 'connect')
      .mockResolvedValue(undefined);
    const query = jest
      .spyOn(pg.Client.prototype, 'query')
      .mockRejectedValue(new Error('all replication slots are in use'));
    try {
      const support = new SqlRealtimeSupport({
        sequelize: {
          getDialect: () => 'postgres',
          query: async (sql: string) => {
            if (sql.includes('pg_settings')) {
              return [
                { name: 'wal_level', setting: 'logical' },
                { name: 'max_replication_slots', setting: '1' },
                { name: 'max_wal_senders', setting: '1' },
              ];
            }
            return [];
          },
        },
        connectionUri: 'postgres://localhost/db',
      } as never);
      const result = await support.checkTopology();
      expect(result).toEqual({ supported: true });
      expect(connect).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    } finally {
      connect.mockRestore();
      query.mockRestore();
    }
  });

  it('fails topology when replication slots or wal senders are zero', async () => {
    const support = new SqlRealtimeSupport({
      sequelize: {
        getDialect: () => 'postgres',
        query: async () => [
          { name: 'wal_level', setting: 'logical' },
          { name: 'max_replication_slots', setting: '0' },
          { name: 'max_wal_senders', setting: '10' },
        ],
      },
      connectionUri: 'postgres://localhost/db',
    } as never);
    const result = await support.checkTopology();
    expect(result.supported).toBe(false);
    expect(result.message).toMatch(/max_replication_slots/);
  });

  it('syncs publication tables and replica identity without changelog DDL', async () => {
    const queries: string[] = [];
    const sequelize = {
      getDialect: () => 'postgres',
      query: async (sql: string) => {
        queries.push(sql);
        if (sql.includes('FROM pg_publication ') && sql.includes('pubname')) {
          return [];
        }
        if (sql.includes('pg_publication_tables')) {
          return [];
        }
        if (sql.includes('relreplident')) {
          return [{ ident: 'd', has_pk: true }];
        }
        return [];
      },
    };
    const support = new SqlRealtimeSupport({
      sequelize,
      connectionUri: 'postgres://localhost/db',
    } as never);
    await support.prepare([
      {
        name: 'Order',
        collectionName: 'orders',
        authorizationEnabled: false,
        documentIdField: 'sku',
      },
    ]);
    expect(queries.some(sql => sql.includes('CREATE PUBLICATION'))).toBe(true);
    expect(queries.some(sql => sql.includes('ADD TABLE'))).toBe(true);
    expect(queries.some(sql => sql.includes(quoteIdent(PUBLICATION_NAME)))).toBe(true);
    expect(
      queries.some(
        sql => sql.includes('_cnd_DatabaseChange') && sql.includes('CREATE TABLE'),
      ),
    ).toBe(false);
    expect(queries.some(sql => sql.includes('CREATE TRIGGER'))).toBe(false);
    expect(queries.some(sql => sql.includes('LISTEN'))).toBe(false);
  });
});

describe('SqlChangeStream', () => {
  it('emits metadata-only WAL changes and uses the physical PK', async () => {
    const feed = new FakeFeed();
    const stream = new SqlChangeStream({
      connectionUri: 'postgres://localhost/db',
      idFieldByTable: { orders: 'sku' },
      createFeed: () => feed,
    });
    const received: unknown[] = [];
    stream.on('change', change => {
      received.push(change);
    });
    await stream.ready;
    feed.push({
      tag: 'insert',
      table: 'orders',
      newRow: { sku: 'sku-1', secret: 'hidden' },
      lsn: '0/1:1:1',
      occurredAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    expect(received).toEqual([
      {
        operationType: 'insert',
        ns: { coll: 'orders' },
        documentKey: { _id: 'sku-1' },
        wallTime: new Date('2026-03-01T00:00:00.000Z'),
        _id: '0/1:1:1',
      },
    ]);
    expect(JSON.stringify(received)).not.toContain('hidden');
    await stream.close();
    expect(feed.stopped).toBe(true);
  });

  it('skips rows with a NULL document id', async () => {
    const feed = new FakeFeed();
    const stream = new SqlChangeStream({
      connectionUri: 'postgres://localhost/db',
      createFeed: () => feed,
    });
    const received: unknown[] = [];
    stream.on('change', change => received.push(change));
    await stream.ready;
    feed.push({
      tag: 'insert',
      table: 'orders',
      newRow: { _id: null, secret: 'ok' },
      lsn: '0/1:1:1',
      occurredAt: new Date(),
    });
    expect(received).toEqual([]);
    await stream.close();
  });

  it('emits error when the replication feed cannot create a slot', async () => {
    const stream = new SqlChangeStream({
      connectionUri: 'postgres://localhost/db',
      createFeed: () => new FailingFeed('all replication slots are in use'),
    });
    const err = await new Promise<unknown>(resolve => {
      stream.on('error', resolve);
    });
    await stream.ready;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/slots are in use/);
    await stream.close();
  });
});

describe('legacy changelog cleanup', () => {
  it('drops leftover sqlite changelog objects without breaking DML', async () => {
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    try {
      await sequelize.query(`CREATE TABLE "orders" (_id TEXT PRIMARY KEY, secret TEXT)`);
      await sequelize.query(
        `CREATE TABLE "${LEGACY_CHANGE_LOG_TABLE}" (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          collection_name TEXT NOT NULL,
          document_id TEXT NOT NULL,
          operation TEXT NOT NULL,
          occurred_at TEXT NOT NULL
        )`,
      );
      await sequelize.query(
        `CREATE TRIGGER "cnd_rt_i_orders" AFTER INSERT ON "orders"
         BEGIN
           INSERT INTO "${LEGACY_CHANGE_LOG_TABLE}" (collection_name, document_id, operation, occurred_at)
           VALUES ('orders', NEW."_id", 'insert', datetime('now'));
         END`,
      );
      const support = new SqlRealtimeSupport({
        sequelize,
        connectionUri: 'sqlite://',
      } as never);
      await support.prepare([]);
      await sequelize.query(`INSERT INTO "orders" (_id, secret) VALUES ('order-1', 'x')`);
      const tables = await sequelize.query(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = :name`,
        { type: QueryTypes.SELECT, replacements: { name: LEGACY_CHANGE_LOG_TABLE } },
      );
      const triggers = await sequelize.query(
        `SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'cnd_rt_%'`,
        { type: QueryTypes.SELECT },
      );
      expect(tables).toEqual([]);
      expect(triggers).toEqual([]);
    } finally {
      await sequelize.close();
    }
  });
});

class FakeFeed implements ReplicationFeed {
  readonly emitter = new EventEmitter();
  started = false;
  stopped = false;

  on(event: 'change', listener: (change: ReplicationChange) => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
  on(event: string, listener: (...args: never[]) => void): void {
    this.emitter.on(event, listener);
  }

  async start(): Promise<void> {
    this.started = true;
  }

  async stop(): Promise<void> {
    this.stopped = true;
  }

  push(change: ReplicationChange): void {
    this.emitter.emit('change', change);
  }
}

class FailingFeed implements ReplicationFeed {
  constructor(private readonly message: string) {}

  on(): void {
    return;
  }

  async start(): Promise<void> {
    throw new Error(this.message);
  }

  async stop(): Promise<void> {
    return;
  }
}
