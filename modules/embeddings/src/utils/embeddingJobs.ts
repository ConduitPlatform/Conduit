export interface EmbeddingJobData {
  schemaName: string;
  documentId: string;
  configId?: string;
  backfillRunId?: string;
}

export const MAX_SCHEMA_NAME_LENGTH = 128;
export const MAX_DOCUMENT_ID_LENGTH = 128;
export const MAX_QUEUE_BATCH_SIZE = 500;

const IDENTITY = /^[A-Za-z0-9._-]{1,128}$/;
const SCHEMA_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

export const IN_FLIGHT_QUEUE_JOB_STATES = [
  'waiting',
  'active',
  'delayed',
  'paused',
  'waiting-children',
  'prioritized',
] as const;

export const TERMINAL_QUEUE_JOB_STATES = ['completed', 'failed'] as const;

export type InFlightQueueJobState = (typeof IN_FLIGHT_QUEUE_JOB_STATES)[number];
export type TerminalQueueJobState = (typeof TERMINAL_QUEUE_JOB_STATES)[number];

export function embeddingJobId(data: EmbeddingJobData): string {
  const parts = [data.schemaName, data.documentId];
  if (data.configId) parts.push(data.configId);
  return parts.join('__');
}

export function isInFlightQueueJobState(state: string): state is InFlightQueueJobState {
  return (IN_FLIGHT_QUEUE_JOB_STATES as readonly string[]).includes(state);
}

export function isTerminalQueueJobState(state: string): state is TerminalQueueJobState {
  return (TERMINAL_QUEUE_JOB_STATES as readonly string[]).includes(state);
}

export function shouldReplaceRetainedQueueJob(state: string): boolean {
  return isTerminalQueueJobState(state);
}

export function dedupeEmbeddingJobs(jobs: EmbeddingJobData[]): EmbeddingJobData[] {
  const seen = new Set<string>();
  const unique: EmbeddingJobData[] = [];
  for (const job of jobs) {
    const id = embeddingJobId(job);
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(job);
  }
  return unique;
}

export function isDuplicateJobError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /already exists/i.test(message);
}

export type ParsedEmbeddingJob =
  { ok: true; data: EmbeddingJobData } | { ok: false; reason: string };

export function parseEmbeddingJobData(
  value: unknown,
  maxBatchIndex?: number,
): ParsedEmbeddingJob {
  if (maxBatchIndex !== undefined && maxBatchIndex >= MAX_QUEUE_BATCH_SIZE) {
    return { ok: false, reason: 'batch_size' };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, reason: 'malformed' };
  }
  const record = value as Record<string, unknown>;
  const extraKeys = Object.keys(record).filter(
    key => !['schemaName', 'documentId', 'configId', 'backfillRunId'].includes(key),
  );
  if (extraKeys.length) return { ok: false, reason: 'malformed' };
  if (typeof record.schemaName !== 'string' || !SCHEMA_NAME.test(record.schemaName)) {
    return { ok: false, reason: 'schemaName' };
  }
  if (typeof record.documentId !== 'string' || !IDENTITY.test(record.documentId)) {
    return { ok: false, reason: 'documentId' };
  }
  if (
    record.configId !== undefined &&
    (typeof record.configId !== 'string' || !IDENTITY.test(record.configId))
  ) {
    return { ok: false, reason: 'configId' };
  }
  if (
    record.backfillRunId !== undefined &&
    (typeof record.backfillRunId !== 'string' || !IDENTITY.test(record.backfillRunId))
  ) {
    return { ok: false, reason: 'backfillRunId' };
  }
  return {
    ok: true,
    data: {
      schemaName: record.schemaName,
      documentId: record.documentId,
      ...(record.configId ? { configId: record.configId } : {}),
      ...(record.backfillRunId ? { backfillRunId: record.backfillRunId } : {}),
    },
  };
}

export function parseEmbeddingJobBatch(values: unknown[]): EmbeddingJobData[] {
  return values
    .slice(0, MAX_QUEUE_BATCH_SIZE)
    .map(value => parseEmbeddingJobData(value))
    .filter((parsed): parsed is { ok: true; data: EmbeddingJobData } => parsed.ok)
    .map(parsed => parsed.data);
}
