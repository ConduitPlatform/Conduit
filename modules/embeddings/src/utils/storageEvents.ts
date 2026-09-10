import { FILE_LIFECYCLE_EVENTS } from './storageEventNames.js';
import { incrementEmbeddingMetric } from './embeddingMetrics.js';

export { FILE_LIFECYCLE_EVENTS };

export const MAX_STORAGE_DELETE_EVENT_IDS = 500;

export interface StorageFileEvent {
  id: string;
  name?: string;
  container?: string;
  folder?: string;
  mimeType?: string;
  size?: number;
  uploadStatus?: string;
  contentVersion?: string;
}

export interface StorageDeleteManyEvent {
  ids: string[];
  container?: string;
  folder?: string;
}

export interface StorageFolderEvent {
  id?: string;
  name: string;
  container: string;
}

export interface StorageContainerEvent {
  id?: string;
  name: string;
  container?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length ? value : undefined;
}

export function parseStorageFileEvent(value: unknown): StorageFileEvent | null {
  const record = asRecord(value);
  const id = optionalString(record?.id);
  if (!record || !id) {
    incrementEmbeddingMetric('malformedEvents');
    return null;
  }
  return {
    id,
    name: optionalString(record.name),
    container: optionalString(record.container),
    folder: optionalString(record.folder),
    mimeType: optionalString(record.mimeType),
    size: typeof record.size === 'number' ? record.size : undefined,
    uploadStatus: optionalString(record.uploadStatus),
    contentVersion: optionalString(record.contentVersion),
  };
}

export function parseStorageDeleteManyEvent(
  value: unknown,
): StorageDeleteManyEvent | null {
  const record = asRecord(value);
  const ids = Array.isArray(record?.ids)
    ? record.ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  if (!ids.length || ids.length > MAX_STORAGE_DELETE_EVENT_IDS) {
    incrementEmbeddingMetric('malformedEvents');
    return null;
  }
  return {
    ids,
    container: optionalString(record?.container),
    folder: optionalString(record?.folder),
  };
}

export function parseStorageFolderEvent(value: unknown): StorageFolderEvent | null {
  const record = asRecord(value);
  const name = optionalString(record?.name);
  const container = optionalString(record?.container);
  if (!name || !container) {
    incrementEmbeddingMetric('malformedEvents');
    return null;
  }
  return {
    id: optionalString(record?.id),
    name,
    container,
  };
}

export function parseStorageContainerEvent(value: unknown): StorageContainerEvent | null {
  const record = asRecord(value);
  const name = optionalString(record?.name) ?? optionalString(record?.container);
  if (!name) {
    incrementEmbeddingMetric('malformedEvents');
    return null;
  }
  return {
    id: optionalString(record?.id),
    name,
    container: optionalString(record?.container) ?? name,
  };
}

export function parseStorageBusMessage(message: string): unknown {
  try {
    return JSON.parse(message);
  } catch {
    incrementEmbeddingMetric('malformedEvents');
    return null;
  }
}
