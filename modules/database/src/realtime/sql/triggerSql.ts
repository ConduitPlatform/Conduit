import {
  CHANGE_LOG_FUNCTION,
  CHANGE_LOG_TABLE,
  PK_COLUMN,
  type SqlDialect,
} from './constants.js';
import {
  quoteIdent,
  rowTriggerName,
  sqlStringLiteral,
  triggerBaseName,
} from './identifiers.js';

export type DesiredTrigger = {
  triggerName: string;
  collectionName: string;
  sql: string;
  dropSql: string;
};

export function desiredTriggers(
  dialect: SqlDialect,
  collectionName: string,
): DesiredTrigger[] {
  const table = quoteIdent(dialect, collectionName);
  const pk = quoteIdent(dialect, PK_COLUMN);
  const logTable = quoteIdent(dialect, CHANGE_LOG_TABLE);
  const collectionLiteral = sqlStringLiteral(collectionName);
  switch (dialect) {
    case 'postgres': {
      const triggerName = triggerBaseName(collectionName, dialect);
      const quotedTrigger = quoteIdent(dialect, triggerName);
      return [
        {
          triggerName,
          collectionName,
          sql: `CREATE TRIGGER ${quotedTrigger}
AFTER INSERT OR UPDATE OR DELETE ON ${table}
FOR EACH ROW EXECUTE PROCEDURE ${CHANGE_LOG_FUNCTION}()`,
          dropSql: `DROP TRIGGER IF EXISTS ${quotedTrigger} ON ${table}`,
        },
      ];
    }
    case 'mysql':
    case 'mariadb':
      return [
        mysqlRowTrigger(dialect, collectionName, 'i', 'INSERT', 'insert', 'NEW'),
        mysqlRowTrigger(dialect, collectionName, 'u', 'UPDATE', 'update', 'NEW'),
        mysqlRowTrigger(dialect, collectionName, 'd', 'DELETE', 'delete', 'OLD'),
      ];
    case 'sqlite':
      return [
        sqliteRowTrigger(
          collectionName,
          'i',
          'INSERT',
          'insert',
          'NEW',
          table,
          pk,
          logTable,
          collectionLiteral,
        ),
        sqliteRowTrigger(
          collectionName,
          'u',
          'UPDATE',
          'update',
          'NEW',
          table,
          pk,
          logTable,
          collectionLiteral,
        ),
        sqliteRowTrigger(
          collectionName,
          'd',
          'DELETE',
          'delete',
          'OLD',
          table,
          pk,
          logTable,
          collectionLiteral,
        ),
      ];
    default: {
      const _exhaustive: never = dialect;
      return _exhaustive;
    }
  }
}

function mysqlRowTrigger(
  dialect: SqlDialect,
  collectionName: string,
  opKey: 'i' | 'u' | 'd',
  timing: 'INSERT' | 'UPDATE' | 'DELETE',
  operation: 'insert' | 'update' | 'delete',
  row: 'NEW' | 'OLD',
): DesiredTrigger {
  const triggerName = rowTriggerName(collectionName, opKey, dialect);
  const quotedTrigger = quoteIdent(dialect, triggerName);
  const table = quoteIdent(dialect, collectionName);
  const pk = quoteIdent(dialect, PK_COLUMN);
  const logTable = quoteIdent(dialect, CHANGE_LOG_TABLE);
  const collectionLiteral = sqlStringLiteral(collectionName);
  const opLiteral = sqlStringLiteral(operation);
  return {
    triggerName,
    collectionName,
    sql: `CREATE TRIGGER ${quotedTrigger} AFTER ${timing} ON ${table}
FOR EACH ROW BEGIN
  INSERT INTO ${logTable} (collection_name, document_id, operation, occurred_at)
  VALUES (${collectionLiteral}, CAST(${row}.${pk} AS CHAR), ${opLiteral}, CURRENT_TIMESTAMP);
END`,
    dropSql: `DROP TRIGGER IF EXISTS ${quotedTrigger}`,
  };
}

function sqliteRowTrigger(
  collectionName: string,
  opKey: 'i' | 'u' | 'd',
  timing: 'INSERT' | 'UPDATE' | 'DELETE',
  operation: 'insert' | 'update' | 'delete',
  row: 'NEW' | 'OLD',
  table: string,
  pk: string,
  logTable: string,
  collectionLiteral: string,
): DesiredTrigger {
  const triggerName = rowTriggerName(collectionName, opKey, 'sqlite');
  const quotedTrigger = quoteIdent('sqlite', triggerName);
  const opLiteral = sqlStringLiteral(operation);
  return {
    triggerName,
    collectionName,
    sql: `CREATE TRIGGER ${quotedTrigger} AFTER ${timing} ON ${table}
BEGIN
  INSERT INTO ${logTable} (collection_name, document_id, operation, occurred_at)
  VALUES (${collectionLiteral}, ${row}.${pk}, ${opLiteral}, datetime('now'));
END`,
    dropSql: `DROP TRIGGER IF EXISTS ${quotedTrigger}`,
  };
}
