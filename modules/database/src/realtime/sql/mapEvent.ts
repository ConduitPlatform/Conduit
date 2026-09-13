import type { RawChangeEvent } from '../normalize.js';
import { DEFAULT_ID_FIELD } from './constants.js';

export type ChangeRows = {
  tag: 'insert' | 'update' | 'delete';
  newRow?: Record<string, string | null>;
  oldRow?: Record<string, string | null>;
  keyRow?: Record<string, string | null>;
};

export type MappedWalChange = {
  operation: 'insert' | 'update' | 'delete';
  table: string;
  documentId: string;
  lsn: string;
  occurredAt: Date;
};

export function documentIdFromChange(
  change: ChangeRows,
  idField: string = DEFAULT_ID_FIELD,
): string | undefined {
  const row =
    change.tag === 'delete'
      ? (change.keyRow ?? change.oldRow)
      : (change.newRow ?? change.keyRow ?? change.oldRow);
  const value = row?.[idField];
  if (value == null || value === '') {
    return undefined;
  }
  return String(value);
}

export function toRawChangeEvent(change: MappedWalChange): RawChangeEvent {
  return {
    operationType: change.operation,
    ns: { coll: change.table },
    documentKey: { _id: change.documentId },
    wallTime: change.occurredAt,
    _id: change.lsn,
  };
}
