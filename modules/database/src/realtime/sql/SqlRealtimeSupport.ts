import pg from 'pg';
import type { SequelizeAdapter } from '../../adapters/sequelize-adapter/index.js';
import type { OptedInSchema } from '../types.js';
import type { ChangeStreamLike } from '../types.js';
import type { TopologyResult } from '../topology.js';
import { NOTIFY_CHANNEL, assertSqlDialect } from './constants.js';
import { ensureChangeLog, maxChangeLogId, trimChangeLog } from './changelog.js';
import { parseSqlResumeId } from './resume.js';
import { SqlChangeStream } from './SqlChangeStream.js';
import { syncTriggers } from './triggers.js';

export class SqlRealtimeSupport {
  private watchFromId = '0';

  constructor(private readonly adapter: SequelizeAdapter) {}

  async checkTopology(): Promise<TopologyResult> {
    const dialect = assertSqlDialect(this.adapter.sequelize.getDialect());
    try {
      await this.adapter.sequelize.query('SELECT 1');
    } catch (err) {
      return {
        supported: false,
        message: `SQL live updates cannot reach the database: ${errorMessage(err)}`,
      };
    }
    if (dialect !== 'postgres') {
      return { supported: true };
    }
    const client = new pg.Client({ connectionString: this.adapter.connectionUri });
    try {
      await client.connect();
      await client.query(`LISTEN ${NOTIFY_CHANNEL}`);
      await client.query(`UNLISTEN ${NOTIFY_CHANNEL}`);
      return { supported: true };
    } catch (err) {
      return {
        supported: false,
        message:
          'PostgreSQL live updates need a session-mode connection that can LISTEN (not a transaction-mode pooler): ' +
          errorMessage(err),
      };
    } finally {
      try {
        await client.end();
      } catch {
        // ignore
      }
    }
  }

  async prepare(
    schemas: OptedInSchema[],
    options?: { ensureLog?: boolean },
  ): Promise<void> {
    const ensureLog = options?.ensureLog !== false;
    if (ensureLog) {
      await ensureChangeLog(this.adapter.sequelize);
      this.watchFromId = await maxChangeLogId(this.adapter.sequelize);
    }
    await syncTriggers(this.adapter.sequelize, schemas);
  }

  openWatch(resumeAfter?: unknown): ChangeStreamLike {
    return new SqlChangeStream({
      sequelize: this.adapter.sequelize,
      connectionUri: this.adapter.connectionUri,
      resumeAfter,
      defaultCursor: this.watchFromId,
    });
  }

  async trimThrough(resumeToken: string): Promise<void> {
    const id = parseSqlResumeId(resumeToken);
    if (!id) return;
    await trimChangeLog(this.adapter.sequelize, id);
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
