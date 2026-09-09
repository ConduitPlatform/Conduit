import { EJSON } from 'bson';
import {
  DATABASE_CHANGE_EVENT_VERSION,
  DATABASE_CHANGE_OPERATIONS,
  type DatabaseChangeEvent,
  type DatabaseChangeOperation,
} from './types.js';

const OPERATION_SET = new Set<string>(DATABASE_CHANGE_OPERATIONS);

export type RawChangeEvent = {
  operationType?: string;
  ns?: { coll?: string };
  documentKey?: { _id?: unknown };
  wallTime?: Date;
  clusterTime?: { toString?: () => string };
  _id?: unknown;
};

export function normalizeChangeEvent(
  change: RawChangeEvent,
  schemaName: string,
  occurredAt: Date = new Date(),
): DatabaseChangeEvent | null {
  const operation = change.operationType;
  if (!operation || !OPERATION_SET.has(operation)) {
    return null;
  }
  const documentId = extractDocumentId(change.documentKey?._id);
  if (!documentId) {
    return null;
  }
  if (!change._id) {
    return null;
  }
  return {
    version: DATABASE_CHANGE_EVENT_VERSION,
    operation: operation as DatabaseChangeOperation,
    schema: schemaName,
    documentId,
    occurredAt: (change.wallTime instanceof Date
      ? change.wallTime
      : occurredAt
    ).toISOString(),
    resumeToken: EJSON.stringify(change._id),
  };
}

export function parseResumeToken(token: string | null | undefined): unknown | undefined {
  if (!token) return undefined;
  try {
    return EJSON.parse(token);
  } catch {
    return undefined;
  }
}

function extractDocumentId(id: unknown): string | null {
  if (id === undefined || id === null) return null;
  if (typeof id === 'string' || typeof id === 'number') return String(id);
  if (typeof id === 'object' && id !== null && 'toHexString' in id) {
    const hex = (id as { toHexString: () => string }).toHexString();
    return typeof hex === 'string' && hex.length > 0 ? hex : null;
  }
  if (typeof id === 'object' && id !== null && 'toString' in id) {
    const value = String(id);
    return value && value !== '[object Object]' ? value : null;
  }
  return null;
}
