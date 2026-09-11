import {
  CHANGE_LOG_FUNCTION,
  CHANGE_LOG_TABLE,
  NOTIFY_CHANNEL,
  PK_COLUMN,
  type SqlDialect,
} from './constants.js';
import { quoteIdent } from './identifiers.js';

export function createChangeLogTableSql(dialect: SqlDialect): string {
  const table = quoteIdent(dialect, CHANGE_LOG_TABLE);
  switch (dialect) {
    case 'postgres':
      return `CREATE TABLE IF NOT EXISTS ${table} (
        id BIGSERIAL PRIMARY KEY,
        collection_name TEXT NOT NULL,
        document_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`;
    case 'mysql':
    case 'mariadb':
      return `CREATE TABLE IF NOT EXISTS ${table} (
        id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        collection_name VARCHAR(255) NOT NULL,
        document_id VARCHAR(255) NOT NULL,
        operation VARCHAR(16) NOT NULL,
        occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`;
    case 'sqlite':
      return `CREATE TABLE IF NOT EXISTS ${table} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_name TEXT NOT NULL,
        document_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`;
    default: {
      const _exhaustive: never = dialect;
      return _exhaustive;
    }
  }
}

export function createCaptureFunctionSql(): string {
  const table = quoteIdent('postgres', CHANGE_LOG_TABLE);
  const pk = quoteIdent('postgres', PK_COLUMN);
  const channel = NOTIFY_CHANNEL.replace(/'/g, "''");
  return `CREATE OR REPLACE FUNCTION ${CHANGE_LOG_FUNCTION}() RETURNS trigger AS $$
DECLARE
  doc_id text;
  op text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    doc_id := OLD.${pk}::text;
    op := 'delete';
  ELSIF TG_OP = 'INSERT' THEN
    doc_id := NEW.${pk}::text;
    op := 'insert';
  ELSE
    doc_id := NEW.${pk}::text;
    op := 'update';
  END IF;
  IF doc_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  INSERT INTO ${table} (collection_name, document_id, operation, occurred_at)
  VALUES (TG_TABLE_NAME, doc_id, op, NOW());
  PERFORM pg_notify('${channel}', '');
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql`;
}
