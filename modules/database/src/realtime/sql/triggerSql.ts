import { CHANGE_LOG_TABLE, PK_COLUMN, type SqlDialect } from './constants.js';
import {
  captureFunctionName,
  quoteIdent,
  rowTriggerName,
  sqlStringLiteral,
  triggerBaseName,
} from './identifiers.js';
import { createCaptureFunctionSql, dropCaptureFunctionSql } from './ddl.js';

export type DesiredTrigger = {
  triggerName: string;
  collectionName: string;
  pkColumn: string;
  sql: string;
  dropSql: string;
  functionName?: string;
  functionSql?: string;
  dropFunctionSql?: string;
};

export function desiredTriggers(
  dialect: SqlDialect,
  collectionName: string,
  pkColumn: string = PK_COLUMN,
): DesiredTrigger[] {
  const table = quoteIdent(dialect, collectionName);
  const pk = quoteIdent(dialect, pkColumn);
  const logTable = quoteIdent(dialect, CHANGE_LOG_TABLE);
  const collectionLiteral = sqlStringLiteral(collectionName);
  switch (dialect) {
    case 'postgres': {
      const triggerName = triggerBaseName(collectionName, dialect);
      const quotedTrigger = quoteIdent(dialect, triggerName);
      const functionName = captureFunctionName(collectionName);
      return [
        {
          triggerName,
          collectionName,
          pkColumn,
          functionName,
          functionSql: createCaptureFunctionSql(pkColumn, functionName),
          dropFunctionSql: dropCaptureFunctionSql(functionName),
          sql: `CREATE TRIGGER ${quotedTrigger}
AFTER INSERT OR UPDATE OR DELETE ON ${table}
FOR EACH ROW EXECUTE PROCEDURE ${quoteIdent(dialect, functionName)}()`,
          dropSql: `DROP TRIGGER IF EXISTS ${quotedTrigger} ON ${table}`,
        },
      ];
    }
    case 'mysql':
    case 'mariadb':
      return [
        mysqlRowTrigger(
          dialect,
          collectionName,
          pkColumn,
          'i',
          'INSERT',
          'insert',
          'NEW',
        ),
        mysqlRowTrigger(
          dialect,
          collectionName,
          pkColumn,
          'u',
          'UPDATE',
          'update',
          'NEW',
        ),
        mysqlRowTrigger(
          dialect,
          collectionName,
          pkColumn,
          'd',
          'DELETE',
          'delete',
          'OLD',
        ),
      ];
    case 'sqlite':
      return [
        sqliteRowTrigger(
          collectionName,
          pkColumn,
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
          pkColumn,
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
          pkColumn,
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
  pkColumn: string,
  opKey: 'i' | 'u' | 'd',
  timing: 'INSERT' | 'UPDATE' | 'DELETE',
  operation: 'insert' | 'update' | 'delete',
  row: 'NEW' | 'OLD',
): DesiredTrigger {
  const triggerName = rowTriggerName(collectionName, opKey, dialect);
  const quotedTrigger = quoteIdent(dialect, triggerName);
  const table = quoteIdent(dialect, collectionName);
  const pk = quoteIdent(dialect, pkColumn);
  const logTable = quoteIdent(dialect, CHANGE_LOG_TABLE);
  const collectionLiteral = sqlStringLiteral(collectionName);
  const opLiteral = sqlStringLiteral(operation);
  return {
    triggerName,
    collectionName,
    pkColumn,
    sql: `CREATE TRIGGER ${quotedTrigger} AFTER ${timing} ON ${table}
FOR EACH ROW BEGIN
  IF ${row}.${pk} IS NOT NULL THEN
    INSERT INTO ${logTable} (collection_name, document_id, operation, occurred_at)
    VALUES (${collectionLiteral}, CAST(${row}.${pk} AS CHAR), ${opLiteral}, CURRENT_TIMESTAMP(6));
  END IF;
END`,
    dropSql: `DROP TRIGGER IF EXISTS ${quotedTrigger}`,
  };
}

function sqliteRowTrigger(
  collectionName: string,
  pkColumn: string,
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
    pkColumn,
    sql: `CREATE TRIGGER ${quotedTrigger} AFTER ${timing} ON ${table}
BEGIN
  INSERT INTO ${logTable} (collection_name, document_id, operation, occurred_at)
  SELECT ${collectionLiteral}, ${row}.${pk}, ${opLiteral}, datetime('now')
  WHERE ${row}.${pk} IS NOT NULL;
END`,
    dropSql: `DROP TRIGGER IF EXISTS ${quotedTrigger}`,
  };
}
