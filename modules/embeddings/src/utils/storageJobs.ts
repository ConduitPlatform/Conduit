export const STORAGE_INGEST_JOB_KINDS = [
  'ingest',
  'delete',
  'deleteMany',
  'deleteFolder',
  'deleteContainer',
  'reconcile',
] as const;

export type StorageIngestJobKind = (typeof STORAGE_INGEST_JOB_KINDS)[number];

export interface StorageIngestJobData {
  kind: StorageIngestJobKind;
  sourceId: string;
  fileId?: string;
  fileIds?: string[];
  contentVersion?: string;
  container?: string;
  folder?: string;
  cursor?: string;
  reason?: 'ready' | 'update' | 'reconcile' | 'delete';
}

const IDENTITY = /^[A-Za-z0-9._:-]{1,128}$/;

export function storageIngestJobId(data: StorageIngestJobData): string {
  switch (data.kind) {
    case 'ingest':
      return `storage-ingest:${data.sourceId}:${data.fileId}:${data.contentVersion ?? 'unknown'}`;
    case 'delete':
      return `storage-delete:${data.sourceId}:${data.fileId}`;
    case 'deleteMany':
      return `storage-deletemany:${data.sourceId}:${(data.fileIds ?? []).join(',')}`;
    case 'deleteFolder':
      return `storage-deletefolder:${data.sourceId}:${data.container}:${data.folder}`;
    case 'deleteContainer':
      return `storage-deletecontainer:${data.sourceId}:${data.container}`;
    case 'reconcile':
      return `storage-reconcile:${data.sourceId}:${data.cursor ?? 'start'}`;
    default: {
      const _never: never = data.kind;
      return _never;
    }
  }
}

export type ParsedStorageIngestJob =
  { ok: true; data: StorageIngestJobData } | { ok: false; reason: string };

export function parseStorageIngestJob(value: unknown): ParsedStorageIngestJob {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, reason: 'malformed' };
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.kind !== 'string' ||
    !(STORAGE_INGEST_JOB_KINDS as readonly string[]).includes(record.kind)
  ) {
    return { ok: false, reason: 'kind' };
  }
  if (typeof record.sourceId !== 'string' || !IDENTITY.test(record.sourceId)) {
    return { ok: false, reason: 'sourceId' };
  }
  const data: StorageIngestJobData = {
    kind: record.kind as StorageIngestJobKind,
    sourceId: record.sourceId,
  };
  if (typeof record.fileId === 'string') data.fileId = record.fileId;
  if (Array.isArray(record.fileIds)) {
    data.fileIds = record.fileIds.filter(
      (id): id is string => typeof id === 'string' && IDENTITY.test(id),
    );
  }
  if (typeof record.contentVersion === 'string')
    data.contentVersion = record.contentVersion;
  if (typeof record.container === 'string') data.container = record.container;
  if (typeof record.folder === 'string') data.folder = record.folder;
  if (typeof record.cursor === 'string') data.cursor = record.cursor;
  if (
    record.reason === 'ready' ||
    record.reason === 'update' ||
    record.reason === 'reconcile' ||
    record.reason === 'delete'
  ) {
    data.reason = record.reason;
  }
  if (data.kind === 'ingest' && !data.fileId) return { ok: false, reason: 'fileId' };
  if (data.kind === 'delete' && !data.fileId) return { ok: false, reason: 'fileId' };
  if (data.kind === 'deleteMany' && !data.fileIds?.length) {
    return { ok: false, reason: 'fileIds' };
  }
  if (data.kind === 'deleteFolder' && (!data.container || !data.folder)) {
    return { ok: false, reason: 'folder' };
  }
  if (data.kind === 'deleteContainer' && !data.container) {
    return { ok: false, reason: 'container' };
  }
  return { ok: true, data };
}

export function dedupeStorageIngestJobs(
  jobs: StorageIngestJobData[],
): StorageIngestJobData[] {
  const seen = new Set<string>();
  const unique: StorageIngestJobData[] = [];
  for (const job of jobs) {
    const id = storageIngestJobId(job);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(job);
  }
  return unique;
}
