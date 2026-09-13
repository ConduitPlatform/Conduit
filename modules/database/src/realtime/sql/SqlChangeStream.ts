import { EventEmitter } from 'node:events';
import type { ChangeStreamLike } from '../types.js';
import { DEFAULT_ID_FIELD, PUBLICATION_NAME } from './constants.js';
import { documentIdFromChange, toRawChangeEvent } from './mapEvent.js';
import {
  createPgoutputFeed,
  type ReplicationChange,
  type ReplicationFeed,
  type ReplicationFeedFactory,
} from './replication.js';

export type SqlChangeStreamOptions = {
  connectionUri: string;
  publicationName?: string;
  idFieldByTable?: Record<string, string>;
  createFeed?: ReplicationFeedFactory;
};

export class SqlChangeStream implements ChangeStreamLike {
  private readonly emitter = new EventEmitter();
  private readonly feed: ReplicationFeed;
  private readonly idFieldByTable: Record<string, string>;
  private closed = false;
  private started = false;

  constructor(options: SqlChangeStreamOptions) {
    this.idFieldByTable = options.idFieldByTable ?? {};
    this.feed = (options.createFeed ?? createPgoutputFeed)({
      connectionUri: options.connectionUri,
      publicationName: options.publicationName ?? PUBLICATION_NAME,
    });
    this.feed.on('change', change => this.onChange(change));
    this.feed.on('error', err => this.emitError(err));
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
    try {
      await this.feed.stop();
    } catch {
      // already closed
    }
    this.emitter.emit('close');
  }

  private async start(): Promise<void> {
    if (this.closed || this.started) return;
    this.started = true;
    try {
      await this.feed.start();
    } catch (err) {
      this.emitError(err);
    }
  }

  private onChange(change: ReplicationChange): void {
    if (this.closed) return;
    const idField = this.idFieldByTable[change.table] ?? DEFAULT_ID_FIELD;
    const documentId = documentIdFromChange(change, idField);
    if (!documentId) return;
    this.emitter.emit(
      'change',
      toRawChangeEvent({
        operation: change.tag,
        table: change.table,
        documentId,
        lsn: change.lsn,
        occurredAt: change.occurredAt,
      }),
    );
  }

  private emitError(err: unknown): void {
    if (this.closed) return;
    this.emitter.emit('error', err);
  }
}
