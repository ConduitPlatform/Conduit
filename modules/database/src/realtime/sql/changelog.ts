import { QueryTypes, Sequelize } from 'sequelize';
import {
  CHANGE_LOG_BATCH_SIZE,
  CHANGE_LOG_LAG_MS,
  CHANGE_LOG_TABLE,
  type SqlDialect,
  assertSqlDialect,
} from './constants.js';
import { quoteIdent } from './identifiers.js';
import { createChangeLogTableSql } from './ddl.js';
import type { ChangeLogRow } from './mapEvent.js';

export function changeLogLagMs(dialect: SqlDialect): number {
  return dialect === 'sqlite' ? 0 : CHANGE_LOG_LAG_MS;
}

export function fetchChangeLogSql(dialect: SqlDialect, lagMs: number): string {
  const table = quoteIdent(dialect, CHANGE_LOG_TABLE);
  return `SELECT id, collection_name, document_id, operation, occurred_at
     FROM ${table}
     WHERE id > :resumeId${lagPredicate(dialect, lagMs)}
     ORDER BY id ASC
     LIMIT :limit`;
}

export async function ensureChangeLog(sequelize: Sequelize): Promise<void> {
  const dialect = assertSqlDialect(sequelize.getDialect());
  await sequelize.query(createChangeLogTableSql(dialect));
}

export async function fetchChangeLogBatch(
  sequelize: Sequelize,
  resumeId: string,
  limit: number = CHANGE_LOG_BATCH_SIZE,
  lagMs?: number,
): Promise<ChangeLogRow[]> {
  const dialect = assertSqlDialect(sequelize.getDialect());
  const resolvedLag = lagMs ?? changeLogLagMs(dialect);
  const rows = await sequelize.query(fetchChangeLogSql(dialect, resolvedLag), {
    type: QueryTypes.SELECT,
    replacements: fetchReplacements(dialect, resumeId, limit, resolvedLag),
  });
  return (rows as Record<string, unknown>[]).map(row => ({
    id: String(row.id),
    collection_name: String(row.collection_name),
    document_id: String(row.document_id),
    operation: String(row.operation),
    occurred_at: occurredAtValue(row.occurred_at),
  }));
}

export async function maxChangeLogId(sequelize: Sequelize): Promise<string> {
  const dialect = assertSqlDialect(sequelize.getDialect());
  const table = quoteIdent(dialect, CHANGE_LOG_TABLE);
  const rows = await sequelize.query(`SELECT MAX(id) AS max_id FROM ${table}`, {
    type: QueryTypes.SELECT,
  });
  const maxId = (rows[0] as { max_id?: unknown } | undefined)?.max_id;
  if (maxId === undefined || maxId === null) {
    return '0';
  }
  return String(maxId);
}

export async function trimChangeLog(
  sequelize: Sequelize,
  throughId: string,
): Promise<void> {
  if (!/^\d+$/.test(throughId)) {
    return;
  }
  const dialect = assertSqlDialect(sequelize.getDialect());
  const table = quoteIdent(dialect, CHANGE_LOG_TABLE);
  for (let i = 0; i < 50; i++) {
    const sql = trimSql(dialect, table);
    const [, metadata] = await sequelize.query(sql, {
      replacements: { id: throughId, limit: CHANGE_LOG_BATCH_SIZE },
    });
    const affected = affectedRows(metadata);
    if (affected === 0) {
      return;
    }
  }
}

function lagPredicate(dialect: SqlDialect, lagMs: number): string {
  if (lagMs <= 0) {
    return '';
  }
  switch (dialect) {
    case 'postgres':
      return ' AND occurred_at <= NOW() - make_interval(secs => :lagSeconds)';
    case 'mysql':
    case 'mariadb':
      return ' AND occurred_at <= DATE_SUB(NOW(6), INTERVAL :lagMicrosecond MICROSECOND)';
    case 'sqlite':
      return ` AND occurred_at <= datetime('now', :lagModifier)`;
    default: {
      const _exhaustive: never = dialect;
      return _exhaustive;
    }
  }
}

function fetchReplacements(
  dialect: SqlDialect,
  resumeId: string,
  limit: number,
  lagMs: number,
): Record<string, string | number> {
  const replacements: Record<string, string | number> = { resumeId, limit };
  if (lagMs <= 0) {
    return replacements;
  }
  switch (dialect) {
    case 'postgres':
      replacements.lagSeconds = lagMs / 1000;
      return replacements;
    case 'mysql':
    case 'mariadb':
      replacements.lagMicrosecond = lagMs * 1000;
      return replacements;
    case 'sqlite':
      replacements.lagModifier = `-${lagMs / 1000} seconds`;
      return replacements;
    default: {
      const _exhaustive: never = dialect;
      return _exhaustive;
    }
  }
}

function trimSql(dialect: SqlDialect, table: string): string {
  switch (dialect) {
    case 'mysql':
    case 'mariadb':
      return `DELETE FROM ${table} WHERE id <= :id ORDER BY id ASC LIMIT :limit`;
    case 'postgres':
    case 'sqlite':
      return `DELETE FROM ${table} WHERE id IN (
        SELECT id FROM ${table} WHERE id <= :id ORDER BY id ASC LIMIT :limit
      )`;
    default: {
      const _exhaustive: never = dialect;
      return _exhaustive;
    }
  }
}

function occurredAtValue(value: unknown): Date | string | number {
  if (value instanceof Date || typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  return new Date().toISOString();
}

function affectedRows(metadata: unknown): number {
  if (!metadata || typeof metadata !== 'object') {
    return 0;
  }
  const record = metadata as { rowCount?: unknown; affectedRows?: unknown };
  if (typeof record.rowCount === 'number') {
    return record.rowCount;
  }
  if (typeof record.affectedRows === 'number') {
    return record.affectedRows;
  }
  return 0;
}
