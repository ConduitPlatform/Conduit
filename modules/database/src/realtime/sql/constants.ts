export const CHANGE_LOG_TABLE = '_cnd_DatabaseChange';
export const CHANGE_LOG_FUNCTION = 'conduit_realtime_capture';
export const NOTIFY_CHANNEL = 'conduit_realtime';
export const TRIGGER_NAME_PREFIX = 'cnd_rt_';
export const PK_COLUMN = '_id';

export const SQL_POLL_INTERVAL_MS = 250;
export const POSTGRES_FALLBACK_POLL_MS = 2_000;
export const CHANGE_LOG_BATCH_SIZE = 200;

export const SQL_DIALECTS = ['postgres', 'mysql', 'mariadb', 'sqlite'] as const;
export type SqlDialect = (typeof SQL_DIALECTS)[number];

export function isSqlDialect(dialect: string): dialect is SqlDialect {
  return (SQL_DIALECTS as readonly string[]).includes(dialect);
}

export function assertSqlDialect(dialect: string): SqlDialect {
  if (isSqlDialect(dialect)) {
    return dialect;
  }
  throw new Error(`Unsupported SQL dialect for live updates: ${dialect}`);
}
