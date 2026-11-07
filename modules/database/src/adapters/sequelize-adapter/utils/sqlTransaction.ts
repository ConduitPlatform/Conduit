import { Transaction, type TransactionOptions } from 'sequelize';

/**
 * Dialects Conduit ships through Sequelize.
 *
 * PostgreSQL, READ COMMITTED: SELECT FOR UPDATE locks the guard row and the
 * file row until commit. A newer fence increment waits on that guard row, so
 * it cannot commit while this write is still in flight. The file UPDATE
 * repeats the caller's predicate. A miss rolls the guard touch back.
 *
 * MySQL and MariaDB (InnoDB), READ COMMITTED: the same row locks. InnoDB
 * reports zero changed rows when every assigned value is identical, so the
 * guard touch moves updatedAt by one second and the file predicate stays in
 * the UPDATE.
 *
 * SQLite has no SELECT FOR UPDATE; Sequelize throws if a lock is requested.
 * An IMMEDIATE transaction takes the database write lock instead. The UPDATE
 * still carries the predicate. Other writers wait or fail with SQLITE_BUSY
 * until this transaction ends; the lease abort signal does not end it.
 */
export type SupportedSqlDialect = 'postgres' | 'mysql' | 'mariadb' | 'sqlite';

export function supportedSqlDialect(dialect: string): SupportedSqlDialect {
  switch (dialect) {
    case 'postgres':
    case 'mysql':
    case 'mariadb':
    case 'sqlite':
      return dialect;
    default:
      throw new Error(`compareAndSet does not support SQL dialect ${dialect}`);
  }
}

export function sqlTransactionOptions(dialect: SupportedSqlDialect): TransactionOptions {
  switch (dialect) {
    case 'sqlite':
      return { type: Transaction.TYPES.IMMEDIATE };
    case 'postgres':
    case 'mysql':
    case 'mariadb':
      return { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED };
    default: {
      const unexpected: never = dialect;
      throw new Error(`compareAndSet does not support SQL dialect ${String(unexpected)}`);
    }
  }
}

export function sqlRowLock(
  dialect: SupportedSqlDialect,
): (typeof Transaction.LOCK)[keyof typeof Transaction.LOCK] | undefined {
  switch (dialect) {
    case 'postgres':
    case 'mysql':
    case 'mariadb':
      return Transaction.LOCK.UPDATE;
    case 'sqlite':
      return undefined;
    default: {
      const unexpected: never = dialect;
      throw new Error(`compareAndSet does not support SQL dialect ${String(unexpected)}`);
    }
  }
}
