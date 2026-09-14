export const PUBLICATION_NAME = 'cnd_realtime';
export const SQL_LEADER_LOCK = 'realtime:sql:change-stream:leader';
export const DEFAULT_ID_FIELD = '_id';
export const DEFAULT_SQL_SCHEMA = 'public';

export const LEGACY_CHANGE_LOG_TABLE = '_cnd_DatabaseChange';
export const LEGACY_TRIGGER_PREFIX = 'cnd_rt_';
export const LEGACY_CAPTURE_FUNCTION_PREFIX = 'cnd_rt_fn_';
export const LEGACY_SHARED_CAPTURE_FUNCTION = 'conduit_realtime_capture';

export const SQL_DIALECTS = ['postgres', 'mysql', 'mariadb', 'sqlite'] as const;
export type SqlDialect = (typeof SQL_DIALECTS)[number];

export const LOGICAL_REPLICATION_UNAVAILABLE =
  'PostgreSQL live updates require logical replication (wal_level=logical, a pgoutput publication, and a replication slot). Leader restart or slot drop skips missed events; clients refetch.';

export const SQL_ENGINE_UNSUPPORTED =
  'Live updates are PostgreSQL WAL CDC only. MySQL, MariaDB, and SQLite are out of v1.';

export function isSqlDialect(dialect: string): dialect is SqlDialect {
  return (SQL_DIALECTS as readonly string[]).includes(dialect);
}

export function sqlSchemaName(): string {
  return process.env.SQL_SCHEMA ?? DEFAULT_SQL_SCHEMA;
}
