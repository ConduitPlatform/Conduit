import type { SequelizeAdapter } from '../../adapters/sequelize-adapter/index.js';
import type { OptedInSchema } from '../types.js';
import type { ChangeStreamLike } from '../types.js';
import { ensureChangeLog, trimChangeLog } from './changelog.js';
import { parseSqlResumeId } from './resume.js';
import { SqlChangeStream } from './SqlChangeStream.js';
import { syncTriggers } from './triggers.js';

export class SqlRealtimeSupport {
  constructor(private readonly adapter: SequelizeAdapter) {}

  async prepare(schemas: OptedInSchema[]): Promise<void> {
    await ensureChangeLog(this.adapter.sequelize);
    await syncTriggers(this.adapter.sequelize, schemas);
  }

  openWatch(resumeAfter?: unknown): ChangeStreamLike {
    return new SqlChangeStream({
      sequelize: this.adapter.sequelize,
      connectionUri: this.adapter.connectionUri,
      resumeAfter,
    });
  }

  async trimThrough(resumeToken: string): Promise<void> {
    const id = parseSqlResumeId(resumeToken);
    if (!id) return;
    await trimChangeLog(this.adapter.sequelize, id);
  }
}
