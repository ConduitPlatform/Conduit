import { QueryTypes, Sequelize } from 'sequelize';
import type { OptedInSchema } from '../types.js';
import {
  CHANGE_LOG_TABLE,
  PK_COLUMN,
  TRIGGER_NAME_PREFIX,
  type SqlDialect,
  assertSqlDialect,
} from './constants.js';
import { quoteIdent } from './identifiers.js';
import { desiredTriggers, type DesiredTrigger } from './triggerSql.js';

export type { DesiredTrigger };
export { desiredTriggers };

export type ExistingTrigger = {
  triggerName: string;
  tableName: string;
  definition?: string;
};

export async function listExistingTriggers(
  sequelize: Sequelize,
): Promise<ExistingTrigger[]> {
  const dialect = assertSqlDialect(sequelize.getDialect());
  const prefix = `${TRIGGER_NAME_PREFIX}%`;
  switch (dialect) {
    case 'postgres': {
      const rows = await sequelize.query(
        `SELECT trigger_name AS trigger_name, event_object_table AS table_name,
                action_statement AS definition
         FROM information_schema.triggers
         WHERE trigger_name LIKE :prefix`,
        { type: QueryTypes.SELECT, replacements: { prefix } },
      );
      return uniqueTriggers(
        rows as { trigger_name: string; table_name: string; definition?: string }[],
      );
    }
    case 'mysql':
    case 'mariadb': {
      const rows = await sequelize.query(
        `SELECT trigger_name AS trigger_name, event_object_table AS table_name,
                action_statement AS definition
         FROM information_schema.triggers
         WHERE trigger_schema = DATABASE()
         AND trigger_name LIKE :prefix`,
        { type: QueryTypes.SELECT, replacements: { prefix } },
      );
      return uniqueTriggers(
        rows as { trigger_name: string; table_name: string; definition?: string }[],
      );
    }
    case 'sqlite': {
      const rows = await sequelize.query(
        `SELECT name AS trigger_name, tbl_name AS table_name, sql AS definition
         FROM sqlite_master
         WHERE type = 'trigger' AND name LIKE :prefix`,
        { type: QueryTypes.SELECT, replacements: { prefix } },
      );
      return uniqueTriggers(
        rows as { trigger_name: string; table_name: string; definition?: string }[],
      );
    }
    default: {
      const _exhaustive: never = dialect;
      return _exhaustive;
    }
  }
}

function uniqueTriggers(
  rows: { trigger_name: string; table_name: string; definition?: string }[],
): ExistingTrigger[] {
  const seen = new Set<string>();
  const result: ExistingTrigger[] = [];
  for (const row of rows) {
    const triggerName = String(row.trigger_name);
    if (seen.has(triggerName)) continue;
    seen.add(triggerName);
    result.push({
      triggerName,
      tableName: String(row.table_name),
      definition: row.definition == null ? undefined : String(row.definition),
    });
  }
  return result;
}

function triggerMatches(
  dialect: SqlDialect,
  trigger: DesiredTrigger,
  definition: string | undefined,
): boolean {
  if (!definition) return false;
  if (trigger.functionName) {
    return definition.includes(trigger.functionName);
  }
  const pk = quoteIdent(dialect, trigger.pkColumn);
  return definition.includes(pk) && /IS NOT NULL/i.test(definition);
}

export async function syncTriggers(
  sequelize: Sequelize,
  schemas: OptedInSchema[],
): Promise<void> {
  const dialect = assertSqlDialect(sequelize.getDialect());
  const desired = new Map<string, DesiredTrigger>();
  for (const schema of schemas) {
    if (schema.collectionName === CHANGE_LOG_TABLE) continue;
    const pkColumn = schema.documentIdField ?? PK_COLUMN;
    for (const trigger of desiredTriggers(dialect, schema.collectionName, pkColumn)) {
      desired.set(trigger.triggerName, trigger);
    }
  }
  const existing = await listExistingTriggers(sequelize);
  const existingByName = new Map(
    existing.map(trigger => [trigger.triggerName, trigger] as const),
  );
  for (const current of existing) {
    if (desired.has(current.triggerName)) continue;
    await sequelize.query(dropExistingSql(dialect, current));
    const leftover = desiredTriggers(dialect, current.tableName, PK_COLUMN).find(
      trigger => trigger.triggerName === current.triggerName,
    );
    if (leftover?.dropFunctionSql) {
      await sequelize.query(leftover.dropFunctionSql);
    }
  }
  for (const trigger of desired.values()) {
    if (trigger.functionSql) {
      await sequelize.query(trigger.functionSql);
    }
    const current = existingByName.get(trigger.triggerName);
    if (current && triggerMatches(dialect, trigger, current.definition)) {
      continue;
    }
    if (current) {
      await sequelize.query(dropExistingSql(dialect, current));
    }
    await sequelize.query(trigger.sql);
  }
}

function dropExistingSql(dialect: SqlDialect, trigger: ExistingTrigger): string {
  const quotedTrigger = quoteIdent(dialect, trigger.triggerName);
  if (dialect === 'postgres') {
    return `DROP TRIGGER IF EXISTS ${quotedTrigger} ON ${quoteIdent(dialect, trigger.tableName)}`;
  }
  return `DROP TRIGGER IF EXISTS ${quotedTrigger}`;
}
