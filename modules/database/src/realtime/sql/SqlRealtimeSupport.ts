import { QueryTypes } from 'sequelize';
import type { SequelizeAdapter } from '../../adapters/sequelize-adapter/index.js';
import type { ChangeStreamLike, OptedInSchema } from '../types.js';
import type { TopologyResult } from '../topology.js';
import {
  DEFAULT_ID_FIELD,
  LOGICAL_REPLICATION_UNAVAILABLE,
  PUBLICATION_NAME,
  SQL_ENGINE_UNSUPPORTED,
  sqlSchemaName,
} from './constants.js';
import { dropLegacyCapture } from './leftover.js';
import { syncPublication } from './publication.js';
import { SqlChangeStream } from './SqlChangeStream.js';
import { createReplicationClient, type ReplicationFeedFactory } from './replication.js';

export class SqlRealtimeSupport {
  private schemas: OptedInSchema[] = [];

  constructor(
    private readonly adapter: SequelizeAdapter,
    private readonly createFeed?: ReplicationFeedFactory,
  ) {}

  async checkTopology(): Promise<TopologyResult> {
    await this.dropLegacyCapture().catch(() => undefined);
    const dialect = this.adapter.sequelize.getDialect();
    if (dialect !== 'postgres') {
      return { supported: false, message: SQL_ENGINE_UNSUPPORTED };
    }
    try {
      await this.adapter.sequelize.query('SELECT 1');
    } catch (err) {
      return {
        supported: false,
        message: `SQL live updates cannot reach the database: ${errorMessage(err)}`,
      };
    }
    return this.probeLogicalReplication();
  }

  async prepare(schemas: OptedInSchema[]): Promise<void> {
    this.schemas = schemas;
    await this.dropLegacyCapture();
    if (this.adapter.sequelize.getDialect() !== 'postgres') {
      return;
    }
    await syncPublication(this.adapter.sequelize, schemas, {
      schemaName: sqlSchemaName(),
      publicationName: PUBLICATION_NAME,
    });
  }

  openWatch(): ChangeStreamLike {
    return new SqlChangeStream({
      connectionUri: this.adapter.connectionUri,
      publicationName: PUBLICATION_NAME,
      idFieldByTable: Object.fromEntries(
        this.schemas.map(schema => [
          schema.collectionName,
          schema.documentIdField ?? DEFAULT_ID_FIELD,
        ]),
      ),
      createFeed: this.createFeed,
    });
  }

  async dropLegacyCapture(): Promise<void> {
    await dropLegacyCapture(this.adapter.sequelize);
  }

  private async probeLogicalReplication(): Promise<TopologyResult> {
    const settings = await this.adapter.sequelize.query(
      `SELECT name, setting
       FROM pg_settings
       WHERE name IN ('wal_level', 'max_replication_slots', 'max_wal_senders')`,
      { type: QueryTypes.SELECT },
    );
    const map = new Map(
      (settings as { name: string; setting: string }[]).map(row => [
        String(row.name),
        String(row.setting),
      ]),
    );
    if (map.get('wal_level') !== 'logical') {
      return {
        supported: false,
        message:
          'PostgreSQL live updates require wal_level=logical (managed Postgres: enable logical replication / rds.logical_replication).',
      };
    }
    if (map.get('max_replication_slots') === '0' || map.get('max_wal_senders') === '0') {
      return {
        supported: false,
        message:
          'PostgreSQL live updates need max_replication_slots and max_wal_senders greater than 0.',
      };
    }
    const client = createReplicationClient(this.adapter.connectionUri);
    const slotName = `cnd_rt_p_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
    try {
      await client.connect();
      await client.query(
        `CREATE_REPLICATION_SLOT ${slotName} TEMPORARY LOGICAL pgoutput`,
      );
      return { supported: true };
    } catch (err) {
      return {
        supported: false,
        message: `${LOGICAL_REPLICATION_UNAVAILABLE} ${errorMessage(err)}`,
      };
    } finally {
      try {
        await client.end();
      } catch {
        // ignore
      }
    }
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
