import { EventEmitter } from 'node:events';
import pg from 'pg';
import type { Sequelize } from 'sequelize';
import type { ChangeStreamLike } from '../types.js';
import {
  CHANGE_LOG_BATCH_SIZE,
  NOTIFY_CHANNEL,
  POSTGRES_FALLBACK_POLL_MS,
  SQL_POLL_INTERVAL_MS,
  assertSqlDialect,
  type SqlDialect,
} from './constants.js';
import { fetchChangeLogBatch, maxChangeLogId } from './changelog.js';
import { toRawChangeEvent } from './mapEvent.js';
import { sqlCursorFromResumeAfter } from './resume.js';

export type SqlChangeStreamOptions = {
  sequelize: Sequelize;
  connectionUri: string;
  resumeAfter?: unknown;
};

export class SqlChangeStream implements ChangeStreamLike {
  private readonly emitter = new EventEmitter();
  private readonly sequelize: Sequelize;
  private readonly connectionUri: string;
  private readonly dialect: SqlDialect;
  private cursor: string | undefined;
  private listenClient: pg.Client | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private closed = false;
  private draining = false;
  private started = false;

  constructor(options: SqlChangeStreamOptions) {
    this.sequelize = options.sequelize;
    this.connectionUri = options.connectionUri;
    this.dialect = assertSqlDialect(options.sequelize.getDialect());
    this.cursor = sqlCursorFromResumeAfter(options.resumeAfter);
    queueMicrotask(() => {
      if (!this.closed) {
        void this.start();
      }
    });
  }

  on(
    event: 'change' | 'error' | 'close' | 'end',
    listener: (...args: unknown[]) => void,
  ): void {
    this.emitter.on(event, listener);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    const client = this.listenClient;
    this.listenClient = null;
    if (client) {
      try {
        await client.query(`UNLISTEN ${NOTIFY_CHANNEL}`);
      } catch {
        // ignore
      }
      try {
        await client.end();
      } catch {
        // ignore
      }
    }
    this.emitter.emit('close');
  }

  private async start(): Promise<void> {
    if (this.closed || this.started) return;
    this.started = true;
    try {
      if (this.cursor === undefined) {
        this.cursor = await maxChangeLogId(this.sequelize);
      }
      if (this.dialect === 'postgres') {
        await this.startPostgresListen();
        this.pollTimer = setInterval(() => {
          void this.drain();
        }, POSTGRES_FALLBACK_POLL_MS);
      } else {
        this.pollTimer = setInterval(() => {
          void this.drain();
        }, SQL_POLL_INTERVAL_MS);
      }
      await this.drain();
    } catch (err) {
      this.emitError(err);
    }
  }

  private async startPostgresListen(): Promise<void> {
    const client = new pg.Client({ connectionString: this.connectionUri });
    this.listenClient = client;
    client.on('notification', () => {
      void this.drain();
    });
    client.on('error', (err: Error) => {
      this.emitError(err);
    });
    await client.connect();
    await client.query(`LISTEN ${NOTIFY_CHANNEL}`);
  }

  private async drain(): Promise<void> {
    if (this.draining || this.closed) return;
    this.draining = true;
    try {
      while (!this.closed) {
        const rows = await fetchChangeLogBatch(
          this.sequelize,
          this.cursor ?? '0',
          CHANGE_LOG_BATCH_SIZE,
        );
        if (rows.length === 0) break;
        for (const row of rows) {
          if (this.closed) return;
          this.emitter.emit('change', toRawChangeEvent(row));
          this.cursor = row.id;
        }
      }
    } catch (err) {
      this.emitError(err);
    } finally {
      this.draining = false;
    }
  }

  private emitError(err: unknown): void {
    if (this.closed) return;
    this.emitter.emit('error', err);
  }
}
