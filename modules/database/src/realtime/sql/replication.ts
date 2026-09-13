import { EventEmitter } from 'node:events';
import pg from 'pg';
import { PUBLICATION_NAME } from './constants.js';
import { quoteLiteral } from './identifiers.js';
import {
  BufferReader,
  PgoutputDecoder,
  formatLsn,
  nowPostgresMicros,
  parseLsn,
  type PgoutputBegin,
  type PgoutputChange,
} from './pgoutput.js';

export type ReplicationChange = {
  tag: 'insert' | 'update' | 'delete';
  table: string;
  newRow?: Record<string, string | null>;
  oldRow?: Record<string, string | null>;
  keyRow?: Record<string, string | null>;
  lsn: string;
  occurredAt: Date;
};

export type ReplicationFeed = {
  on(event: 'change', listener: (change: ReplicationChange) => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
  start(): Promise<void>;
  stop(): Promise<void>;
};

export type ReplicationFeedFactory = (options: {
  connectionUri: string;
  publicationName?: string;
}) => ReplicationFeed;

type PgReplicationConnection = {
  on(event: 'copyData', listener: (msg: { chunk: Buffer }) => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
  sendCopyFromChunk?(chunk: Buffer): void;
};

const XLOG_HEADER_BYTES = 25;
const STANDBY_STATUS_INTERVAL_MS = 10_000;

export class PgoutputReplicationFeed implements ReplicationFeed {
  private readonly emitter = new EventEmitter();
  private readonly connectionUri: string;
  private readonly publicationName: string;
  private readonly decoder = new PgoutputDecoder();
  private client: pg.Client | null = null;
  private ackTimer: NodeJS.Timeout | null = null;
  private closed = false;
  private started = false;
  private lastBegin: PgoutputBegin | undefined;
  private changeSeq = 0;
  private flushedLsn = 0n;

  constructor(options: { connectionUri: string; publicationName?: string }) {
    this.connectionUri = options.connectionUri;
    this.publicationName = options.publicationName ?? PUBLICATION_NAME;
  }

  on(event: 'change', listener: (change: ReplicationChange) => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
  on(
    event: 'change' | 'error',
    listener: ((change: ReplicationChange) => void) | ((err: Error) => void),
  ): void {
    this.emitter.on(event, listener);
  }

  async start(): Promise<void> {
    if (this.closed || this.started) return;
    this.started = true;
    const slotName = replicationSlotName();
    const client = createReplicationClient(this.connectionUri);
    this.client = client;
    client.on('error', err => this.emitError(err));
    await client.connect();
    if (this.closed) {
      await this.stop();
      return;
    }
    const slot = await client.query(
      `CREATE_REPLICATION_SLOT ${slotName} TEMPORARY LOGICAL pgoutput`,
    );
    const consistentPoint = String(slot.rows[0]?.consistent_point ?? '0/0');
    this.flushedLsn = parseLsn(consistentPoint);
    const connection = replicationConnection(client);
    connection.on('copyData', msg => {
      try {
        this.onCopyData(msg.chunk, connection);
      } catch (err) {
        this.emitError(err);
      }
    });
    this.ackTimer = setInterval(() => {
      sendStandbyStatus(connection, this.flushedLsn);
    }, STANDBY_STATUS_INTERVAL_MS);
    const startSql =
      `START_REPLICATION SLOT ${slotName} LOGICAL ${consistentPoint} (` +
      `proto_version '1', publication_names ${quoteLiteral(this.publicationName)})`;
    void client.query(startSql).catch(err => this.emitError(err));
  }

  async stop(): Promise<void> {
    this.closed = true;
    if (this.ackTimer) {
      clearInterval(this.ackTimer);
      this.ackTimer = null;
    }
    const client = this.client;
    this.client = null;
    if (!client) return;
    try {
      await client.end();
    } catch {
      // already closed
    }
  }

  private onCopyData(chunk: Buffer, connection: PgReplicationConnection): void {
    if (this.closed || chunk.length === 0) return;
    const type = String.fromCharCode(chunk[0]);
    if (type === 'k') {
      this.onKeepalive(chunk, connection);
      return;
    }
    if (type !== 'w' || chunk.length < XLOG_HEADER_BYTES) return;
    const reader = new BufferReader(chunk, 1);
    const walStart = reader.u64();
    reader.u64();
    reader.i64();
    const message = this.decoder.decodeMessage(chunk.subarray(XLOG_HEADER_BYTES));
    this.flushedLsn = walStart > this.flushedLsn ? walStart : this.flushedLsn;
    if (!message) return;
    if (message.tag === 'begin') {
      this.lastBegin = message;
      this.changeSeq = 0;
      return;
    }
    this.emitChange(message, walStart);
  }

  private onKeepalive(chunk: Buffer, connection: PgReplicationConnection): void {
    if (chunk.length < 18) return;
    const reader = new BufferReader(chunk, 1);
    const walEnd = reader.u64();
    reader.i64();
    const replyRequested = reader.u8() === 1;
    if (walEnd > this.flushedLsn) {
      this.flushedLsn = walEnd;
    }
    if (replyRequested) {
      sendStandbyStatus(connection, this.flushedLsn);
    }
  }

  private emitChange(change: PgoutputChange, walStart: bigint): void {
    this.changeSeq += 1;
    const xid = this.lastBegin?.xid ?? 0;
    const occurredAt = this.lastBegin?.commitTime ?? new Date();
    this.emitter.emit('change', {
      tag: change.tag,
      table: change.relation.name,
      newRow: change.newRow,
      oldRow: change.oldRow,
      keyRow: change.keyRow,
      lsn: `${formatLsn(walStart)}:${xid}:${this.changeSeq}`,
      occurredAt,
    });
  }

  private emitError(err: unknown): void {
    if (this.closed) return;
    this.emitter.emit('error', err instanceof Error ? err : new Error(String(err)));
  }
}

export function createReplicationClient(connectionString: string): pg.Client {
  const config: pg.ClientConfig & { replication: 'database' } = {
    connectionString,
    replication: 'database',
  };
  return new pg.Client(config);
}

export function createPgoutputFeed(options: {
  connectionUri: string;
  publicationName?: string;
}): ReplicationFeed {
  return new PgoutputReplicationFeed(options);
}

function replicationSlotName(): string {
  return `cnd_rt_${process.pid}_${Math.random().toString(36).slice(2, 10)}`;
}

function replicationConnection(client: pg.Client): PgReplicationConnection {
  const connection = (client as unknown as { connection?: PgReplicationConnection })
    .connection;
  if (!connection) {
    throw new Error('PostgreSQL client is missing the replication connection');
  }
  return connection;
}

function sendStandbyStatus(connection: PgReplicationConnection, lsn: bigint): void {
  if (!connection.sendCopyFromChunk) return;
  const buf = Buffer.alloc(1 + 8 + 8 + 8 + 8 + 1);
  buf[0] = 0x72;
  buf.writeBigUInt64BE(lsn, 1);
  buf.writeBigUInt64BE(lsn, 9);
  buf.writeBigUInt64BE(lsn, 17);
  buf.writeBigInt64BE(nowPostgresMicros(), 25);
  buf[33] = 0;
  connection.sendCopyFromChunk(buf);
}
