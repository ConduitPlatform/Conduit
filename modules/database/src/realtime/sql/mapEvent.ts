import type { RawChangeEvent } from '../normalize.js';

export type ChangeLogRow = {
  id: string;
  collection_name: string;
  document_id: string;
  operation: string;
  occurred_at: Date | string | number;
};

export function toRawChangeEvent(row: ChangeLogRow): RawChangeEvent {
  const occurredAt =
    row.occurred_at instanceof Date ? row.occurred_at : new Date(row.occurred_at);
  return {
    operationType: row.operation,
    ns: { coll: row.collection_name },
    documentKey: { _id: row.document_id },
    wallTime: Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
    _id: row.id,
  };
}
