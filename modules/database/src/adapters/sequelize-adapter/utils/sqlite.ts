import { Options, Sequelize, Transaction } from 'sequelize';

/**
 * How long a SQLite connection waits for another connection's lock before failing
 * with SQLITE_BUSY. This covers writes issued outside a transaction (which wait for
 * a transaction owner to commit). node-sqlite3 defaults to 1s.
 */
export const SQLITE_BUSY_TIMEOUT_MS = 30_000;

/**
 * SQLite allows a single writer, and every Sequelize transaction on a file-backed
 * database opens its own connection. A busy timeout alone does not make concurrent
 * transactions reliable: each connection waiting in `BEGIN IMMEDIATE` sleeps inside
 * a libuv threadpool thread (4 by default), so a handful of waiting transactions
 * starves the threadpool and the lock holder can no longer run the statements that
 * would release the lock. Transactions are therefore queued in-process, per
 * Sequelize instance, so at most one is open at a time and none ever waits on the
 * database lock.
 */
export function serializeSqliteTransactions(sequelize: Sequelize) {
  const original = sequelize.transaction.bind(sequelize) as (...args: any[]) => any;
  let tail: Promise<void> = Promise.resolve();

  const acquire = async () => {
    let release!: () => void;
    const released = new Promise<void>(resolve => (release = resolve));
    const previous = tail;
    tail = previous.then(() => released);
    await previous;
    return release;
  };

  (sequelize as any).transaction = async (...args: any[]) => {
    const release = await acquire();
    if (typeof args[args.length - 1] === 'function') {
      // Managed transaction: Sequelize commits or rolls back when the callback ends.
      try {
        return await original(...args);
      } finally {
        release();
      }
    }
    let t: Transaction;
    try {
      t = await original(...args);
    } catch (e) {
      release();
      throw e;
    }
    // Unmanaged transaction: the slot is held until commit() or rollback() settles.
    let released = false;
    const releaseOnce = () => {
      if (released) return;
      released = true;
      release();
    };
    const commit = t.commit.bind(t);
    const rollback = t.rollback.bind(t);
    t.commit = () => commit().finally(releaseOnce);
    t.rollback = () => rollback().finally(releaseOnce);
    return t;
  };
}

/**
 * Sequelize's sqlite dialect overrides `getConnection` and never runs the
 * `afterConnect` hook, so the busy timeout is applied by wrapping it. It is set on
 * every connection handed out (the call is idempotent), including the
 * per-transaction ones.
 */
function applyBusyTimeout(sequelize: Sequelize, timeoutMs: number) {
  const manager = sequelize.connectionManager as any;
  const getConnection = manager.getConnection.bind(manager);
  manager.getConnection = async (options?: unknown) => {
    const connection = await getConnection(options);
    connection.configure('busyTimeout', timeoutMs);
    return connection;
  };
}

export function configureSqlite(
  sequelize: Sequelize,
  busyTimeoutMs: number = SQLITE_BUSY_TIMEOUT_MS,
) {
  if (sequelize.getDialect() !== 'sqlite') return sequelize;
  applyBusyTimeout(sequelize, busyTimeoutMs);
  serializeSqliteTransactions(sequelize);
  return sequelize;
}

/** Constructs Sequelize from a connection uri, with SQLite tuned for concurrent writers. */
export function createSequelize(connectionUri: string, options: Options = {}) {
  return configureSqlite(new Sequelize(connectionUri, { logging: false, ...options }));
}
