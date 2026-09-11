import { QueryTypes, Sequelize } from 'sequelize';
import {
  CHANGE_LOG_BATCH_SIZE,
  CHANGE_LOG_TABLE,
  type SqlDialect,
  assertSqlDialect,
} from './constants.js';
import { quoteIdent } from './identifiers.js';
import { createCaptureFunctionSql, createChangeLogTableSql } from './ddl.js';
import type { ChangeLogRow } from './mapEvent.js';

export async function ensureChangeLog(sequelize: Sequelize): Promise<void> {
  const dialect = assertSqlDialect(sequelize.getDialect());
  await sequelize.query(createChangeLogTableSql(dialect));
  if (dialect === 'postgres') {
    await sequelize.query(createCaptureFunctionSql());
  }
}

export async function fetchChangeLogBatch(
  sequelize: Sequelize,
  resumeId: string,
  limit: number = CHANGE_LOG_BATCH_SIZE,
): Promise<ChangeLogRow[]> {
  const dialect = assertSqlDialect(sequelize.getDialect());
  const table = quoteIdent(dialect, CHANGE_LOG_TABLE);
  const rows = await sequelize.query(
    `SELECT id, collection_name, document_id, operation, occurred_at
     FROM ${table}
     WHERE id > :resumeId
     ORDER BY id ASC
     LIMIT :limit`,
    {
      type: QueryTypes.SELECT,
      replacements: { resumeId, limit },
    },
  );
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
