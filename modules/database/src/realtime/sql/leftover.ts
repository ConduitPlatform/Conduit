import { QueryTypes, Sequelize } from 'sequelize';
import {
  LEGACY_CAPTURE_FUNCTION_PREFIX,
  LEGACY_CHANGE_LOG_TABLE,
  LEGACY_SHARED_CAPTURE_FUNCTION,
  LEGACY_TRIGGER_PREFIX,
  type SqlDialect,
  isSqlDialect,
} from './constants.js';
import { mysqlQuoteIdent, quoteIdent } from './identifiers.js';

export async function dropLegacyCapture(sequelize: Sequelize): Promise<void> {
  const dialect = sequelize.getDialect();
  if (!isSqlDialect(dialect)) return;
  switch (dialect) {
    case 'postgres':
      await dropPostgresLegacy(sequelize);
      return;
    case 'mysql':
    case 'mariadb':
      await dropMysqlLegacy(sequelize);
      return;
    case 'sqlite':
      await dropSqliteLegacy(sequelize);
      return;
    default: {
      const _exhaustive: never = dialect;
      return _exhaustive;
    }
  }
}

async function dropPostgresLegacy(sequelize: Sequelize): Promise<void> {
  const triggers = await sequelize.query(
    `SELECT event_object_schema AS table_schema,
            event_object_table AS table_name,
            trigger_name AS trigger_name
     FROM information_schema.triggers
     WHERE trigger_name LIKE :prefix`,
    {
      type: QueryTypes.SELECT,
      replacements: { prefix: `${LEGACY_TRIGGER_PREFIX}%` },
    },
  );
  const seen = new Set<string>();
  for (const row of triggers as {
    table_schema: string;
    table_name: string;
    trigger_name: string;
  }[]) {
    const key = `${row.table_schema}.${row.table_name}.${row.trigger_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await sequelize.query(
      `DROP TRIGGER IF EXISTS ${quoteIdent(row.trigger_name)} ON ${quoteIdent(
        row.table_schema,
      )}.${quoteIdent(row.table_name)}`,
    );
  }
  const functions = await sequelize.query(
    `SELECT p.proname AS function_name
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = current_schema()
       AND (p.proname LIKE :prefix OR p.proname = :shared)`,
    {
      type: QueryTypes.SELECT,
      replacements: {
        prefix: `${LEGACY_CAPTURE_FUNCTION_PREFIX}%`,
        shared: LEGACY_SHARED_CAPTURE_FUNCTION,
      },
    },
  );
  for (const row of functions as { function_name: string }[]) {
    await sequelize.query(`DROP FUNCTION IF EXISTS ${quoteIdent(row.function_name)}()`);
  }
  await sequelize.query(`DROP TABLE IF EXISTS ${quoteIdent(LEGACY_CHANGE_LOG_TABLE)}`);
}

async function dropMysqlLegacy(sequelize: Sequelize): Promise<void> {
  const triggers = await sequelize.query(
    `SELECT trigger_name AS trigger_name
     FROM information_schema.triggers
     WHERE trigger_schema = DATABASE()
       AND trigger_name LIKE :prefix`,
    {
      type: QueryTypes.SELECT,
      replacements: { prefix: `${LEGACY_TRIGGER_PREFIX}%` },
    },
  );
  const seen = new Set<string>();
  for (const row of triggers as { trigger_name: string }[]) {
    const name = String(row.trigger_name);
    if (seen.has(name)) continue;
    seen.add(name);
    await sequelize.query(`DROP TRIGGER IF EXISTS ${mysqlQuoteIdent(name)}`);
  }
  await sequelize.query(
    `DROP TABLE IF EXISTS ${mysqlQuoteIdent(LEGACY_CHANGE_LOG_TABLE)}`,
  );
}

async function dropSqliteLegacy(sequelize: Sequelize): Promise<void> {
  const triggers = await sequelize.query(
    `SELECT name AS trigger_name
     FROM sqlite_master
     WHERE type = 'trigger' AND name LIKE :prefix`,
    {
      type: QueryTypes.SELECT,
      replacements: { prefix: `${LEGACY_TRIGGER_PREFIX}%` },
    },
  );
  for (const row of triggers as { trigger_name: string }[]) {
    await sequelize.query(`DROP TRIGGER IF EXISTS ${quoteIdent(row.trigger_name)}`);
  }
  await sequelize.query(`DROP TABLE IF EXISTS ${quoteIdent(LEGACY_CHANGE_LOG_TABLE)}`);
}
