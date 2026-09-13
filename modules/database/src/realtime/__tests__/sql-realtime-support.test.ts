import { describe, expect, it, jest } from '@jest/globals';
import pg from 'pg';
import { QueryTypes, Sequelize } from 'sequelize';
import { SqlChangeStream } from '../sql/SqlChangeStream.js';
import { SqlRealtimeSupport } from '../sql/SqlRealtimeSupport.js';
import { CHANGE_LOG_TABLE } from '../sql/constants.js';
import { captureFunctionName, triggerBaseName } from '../sql/identifiers.js';
import { syncTriggers } from '../sql/triggers.js';

describe('SqlRealtimeSupport', () => {
  it('does not CREATE TABLE when ensureLog is false', async () => {
    const sequelize = new Sequelize({
      dialect: 'sqlite',
      storage: ':memory:',
      logging: false,
    });
    try {
      const support = new SqlRealtimeSupport({
        sequelize,
        connectionUri: 'sqlite://',
      } as never);
      await support.prepare([], { ensureLog: false });
      const tables = await sequelize.query(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = :name`,
        { type: QueryTypes.SELECT, replacements: { name: CHANGE_LOG_TABLE } },
      );
      expect(tables).toEqual([]);
    } finally {
      await sequelize.close();
    }
  });

  it('retargets leftover postgres triggers that still call conduit_realtime_capture', async () => {
    const triggerName = triggerBaseName('orders', 'postgres');
    const functionName = captureFunctionName('orders');
    const queries: string[] = [];
    const sequelize = {
      getDialect: () => 'postgres',
      query: async (sql: string) => {
        queries.push(sql);
        if (sql.includes('information_schema.triggers')) {
          return [
            {
              trigger_name: triggerName,
              table_name: 'orders',
              definition: 'EXECUTE PROCEDURE conduit_realtime_capture()',
            },
          ];
        }
        return [];
      },
    };
    await syncTriggers(sequelize as never, [
      {
        name: 'Order',
        collectionName: 'orders',
        authorizationEnabled: false,
        documentIdField: 'sku',
      },
    ]);
    expect(queries.some(sql => sql.includes('DROP TRIGGER'))).toBe(true);
    expect(
      queries.some(
        sql =>
          sql.includes('CREATE TRIGGER') &&
          sql.includes(functionName) &&
          !sql.includes('conduit_realtime_capture'),
      ),
    ).toBe(true);
  });

  it('leaves a matching postgres trigger in place', async () => {
    const triggerName = triggerBaseName('orders', 'postgres');
    const functionName = captureFunctionName('orders');
    const queries: string[] = [];
    const sequelize = {
      getDialect: () => 'postgres',
      query: async (sql: string) => {
        queries.push(sql);
        if (sql.includes('information_schema.triggers')) {
          return [
            {
              trigger_name: triggerName,
              table_name: 'orders',
              definition: `EXECUTE PROCEDURE ${functionName}()`,
            },
          ];
        }
        return [];
      },
    };
    await syncTriggers(sequelize as never, [
      {
        name: 'Order',
        collectionName: 'orders',
        authorizationEnabled: false,
        documentIdField: 'sku',
      },
    ]);
    expect(queries.some(sql => sql.includes('DROP TRIGGER'))).toBe(false);
    expect(queries.some(sql => sql.includes('CREATE TRIGGER'))).toBe(false);
    expect(queries.some(sql => sql.includes('CREATE OR REPLACE FUNCTION'))).toBe(true);
  });

  it('reports postgres live updates unsupported when LISTEN fails', async () => {
    const connect = jest
      .spyOn(pg.Client.prototype, 'connect')
      .mockRejectedValue(new Error('LISTEN not allowed'));
    try {
      const support = new SqlRealtimeSupport({
        sequelize: {
          getDialect: () => 'postgres',
          query: async () => [[]],
        },
        connectionUri: 'postgres://localhost/db',
      } as never);
      const result = await support.checkTopology();
      expect(result.supported).toBe(false);
      expect(result.message).toMatch(/LISTEN/);
    } finally {
      connect.mockRestore();
    }
  });
});

describe('SqlChangeStream drain coalesce', () => {
  it('fetches again when a notify arrives while a drain is in flight', async () => {
    let fetches = 0;
    let releaseFirst!: (rows: Record<string, unknown>[]) => void;
    const firstFetch = new Promise<Record<string, unknown>[]>(resolve => {
      releaseFirst = resolve;
    });
    const sequelize = {
      getDialect: () => 'postgres',
      query: async (sql: string) => {
        if (typeof sql === 'string' && sql.includes('WHERE id >')) {
          fetches += 1;
          if (fetches === 1) {
            return firstFetch;
          }
          if (fetches === 2) {
            return [
              {
                id: 2,
                collection_name: 'orders',
                document_id: 'second',
                operation: 'insert',
                occurred_at: new Date().toISOString(),
              },
            ];
          }
          return [];
        }
        return [];
      },
    };
    const listeners: Record<string, () => void> = {};
    const fakeClient = {
      on(event: string, cb: () => void) {
        listeners[event] = cb;
      },
      connect: async () => undefined,
      query: async () => undefined,
      end: async () => undefined,
    };
    const Client = jest.spyOn(pg, 'Client').mockImplementation(() => fakeClient as never);
    const stream = new SqlChangeStream({
      sequelize: sequelize as never,
      connectionUri: 'postgres://localhost/db',
      defaultCursor: '0',
    });
    try {
      const received: unknown[] = [];
      stream.on('change', change => {
        received.push(change);
      });
      await waitUntil(() => fetches === 1);
      listeners.notification?.();
      releaseFirst([]);
      await waitUntil(() => received.length >= 1);
      expect(fetches).toBeGreaterThanOrEqual(2);
      expect(received).toHaveLength(1);
      expect(received[0]).toMatchObject({
        documentKey: { _id: 'second' },
      });
    } finally {
      await stream.close();
      Client.mockRestore();
    }
  });
});

async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('timed out waiting for condition');
}
