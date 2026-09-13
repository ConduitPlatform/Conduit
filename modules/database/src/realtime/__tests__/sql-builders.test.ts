import { describe, expect, it } from '@jest/globals';
import { EJSON } from 'bson';
import { parseSqlResumeId, sqlCursorFromResumeAfter } from '../sql/resume.js';
import { createCaptureFunctionSql, createChangeLogTableSql } from '../sql/ddl.js';
import { desiredTriggers } from '../sql/triggerSql.js';
import { CHANGE_LOG_TABLE, PK_COLUMN } from '../sql/constants.js';
import { fetchChangeLogSql } from '../sql/changelog.js';
import {
  captureFunctionName,
  fitIdentifier,
  quoteIdent,
  rowTriggerName,
  triggerBaseName,
} from '../sql/identifiers.js';
import { toRawChangeEvent } from '../sql/mapEvent.js';
import { normalizeChangeEvent } from '../normalize.js';

describe('SQL realtime builders', () => {
  it('quotes identifiers per dialect', () => {
    expect(quoteIdent('postgres', 'orders')).toBe('"orders"');
    expect(quoteIdent('mysql', 'orders')).toBe('`orders`');
    expect(quoteIdent('sqlite', 'weird"name')).toBe('"weird""name"');
  });

  it('fits trigger names into dialect identifier limits', () => {
    const long = 'c'.repeat(80);
    expect(fitIdentifier(long, 64).length).toBeLessThanOrEqual(64);
    expect(triggerBaseName(long, 'postgres').length).toBeLessThanOrEqual(63);
    expect(rowTriggerName(long, 'i', 'mysql').length).toBeLessThanOrEqual(64);
  });

  it('builds a postgres capture function and per-table trigger using the physical PK', () => {
    const functionName = captureFunctionName('orders');
    const fn = createCaptureFunctionSql('sku', functionName);
    expect(fn).toContain(quoteIdent('postgres', functionName));
    expect(fn).toContain(CHANGE_LOG_TABLE);
    expect(fn).toContain('"sku"');
    expect(fn).not.toContain('"_id"');
    expect(fn).toContain('pg_notify');
    const triggers = desiredTriggers('postgres', 'orders', 'sku');
    expect(triggers).toHaveLength(1);
    expect(triggers[0].sql).toMatch(/AFTER INSERT OR UPDATE OR DELETE/);
    expect(triggers[0].sql).toContain('EXECUTE PROCEDURE');
    expect(triggers[0].sql).toContain(quoteIdent('postgres', functionName));
    expect(triggers[0].dropSql).toMatch(/DROP TRIGGER IF EXISTS/);
    expect(triggers[0].functionSql).toContain('"sku"');
  });

  it('builds three row triggers for mysql and sqlite that skip NULL PKs', () => {
    expect(desiredTriggers('mysql', 'orders')).toHaveLength(3);
    expect(desiredTriggers('mariadb', 'cnd_User')).toHaveLength(3);
    const sqlite = desiredTriggers('sqlite', 'orders');
    expect(sqlite.map(t => t.triggerName)).toEqual([
      rowTriggerName('orders', 'i', 'sqlite'),
      rowTriggerName('orders', 'u', 'sqlite'),
      rowTriggerName('orders', 'd', 'sqlite'),
    ]);
    expect(sqlite[0].sql).toContain(CHANGE_LOG_TABLE);
    expect(sqlite[0].sql).toContain('IS NOT NULL');
    expect(desiredTriggers('mysql', 'orders', PK_COLUMN)[0].sql).toContain('IS NOT NULL');
  });

  it('builds dialect-specific change-log tables', () => {
    expect(createChangeLogTableSql('postgres')).toMatch(/BIGSERIAL/);
    expect(createChangeLogTableSql('mysql')).toMatch(/AUTO_INCREMENT/);
    expect(createChangeLogTableSql('sqlite')).toMatch(/AUTOINCREMENT/);
  });

  it('adds a commit-visibility lag predicate for postgres and mysql', () => {
    expect(fetchChangeLogSql('postgres', 750)).toContain('make_interval');
    expect(fetchChangeLogSql('mysql', 750)).toContain('DATE_SUB');
    expect(fetchChangeLogSql('sqlite', 0)).not.toContain('datetime');
  });
});

describe('SQL resume tokens', () => {
  it('accepts decimal ids and ignores leftover Mongo tokens', () => {
    expect(parseSqlResumeId('1842')).toBe('1842');
    expect(parseSqlResumeId(EJSON.stringify('1842'))).toBe('1842');
    expect(parseSqlResumeId(EJSON.stringify(1842))).toBe('1842');
    expect(parseSqlResumeId(EJSON.stringify({ _data: 'mongo' }))).toBeUndefined();
    expect(sqlCursorFromResumeAfter(1842)).toBe('1842');
    expect(sqlCursorFromResumeAfter({ _data: 'mongo' })).toBeUndefined();
    expect(sqlCursorFromResumeAfter(Number.MAX_SAFE_INTEGER + 1)).toBeUndefined();
  });
});

describe('SQL change-log event mapping', () => {
  it('maps log rows to metadata-only change events', () => {
    const raw = toRawChangeEvent({
      id: '1842',
      collection_name: 'orders',
      document_id: 'order-1',
      operation: 'insert',
      occurred_at: '2026-03-01T00:00:00.000Z',
    });
    const event = normalizeChangeEvent(raw, 'Order');
    expect(event).toMatchObject({
      operation: 'insert',
      schema: 'Order',
      documentId: 'order-1',
    });
  });
});
