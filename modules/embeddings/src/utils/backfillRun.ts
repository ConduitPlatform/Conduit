import { sanitizeErrorMessage } from './redactConfig.js';
import { MAX_QUEUE_BATCH_SIZE } from './embeddingJobs.js';

export const BACKFILL_RUN_SCHEMA = 'BackfillRun';

export const BACKFILL_RUN_STATES = [
  'queued',
  'running',
  'completed',
  'failed',
  'canceled',
] as const;

export type BackfillRunState = (typeof BACKFILL_RUN_STATES)[number];

export const LEGAL_BACKFILL_TRANSITIONS: Record<
  BackfillRunState,
  readonly BackfillRunState[]
> = {
  queued: ['running', 'failed', 'canceled'],
  running: ['completed', 'failed', 'canceled'],
  completed: [],
  failed: ['queued'],
  canceled: ['queued'],
};

export const ACTIVE_BACKFILL_STATES: readonly BackfillRunState[] = ['queued', 'running'];

export const MIN_BACKFILL_BATCH_SIZE = 1;
export const DEFAULT_BACKFILL_BATCH_SIZE = 100;
export const MAX_BACKFILL_BATCH_SIZE = MAX_QUEUE_BATCH_SIZE;
export const MAX_BACKFILL_ERROR_LENGTH = 1024;
export const MAX_BACKFILL_FILTER_BYTES = 4 * 1024;

const SCHEMA_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
const IDENTITY = /^[A-Za-z0-9._-]{1,128}$/;
const DANGEROUS_FILTER_KEY = /^(\$where|\$function|\$accumulator|__proto__|constructor)$/;

export interface BackfillRunProgress {
  state: BackfillRunState;
  schemaName: string;
  configId?: string;
  cursor?: string | null;
  batchSize: number;
  onlyMissing: boolean;
  filter?: Record<string, unknown> | null;
  scannedCount: number;
  queuedCount: number;
  processedCount: number;
  failedCount: number;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  drainStartedAt?: Date | null;
  error?: string | null;
}

export interface CreateBackfillRunInput {
  schemaName: string;
  configId?: string;
  batchSize?: number;
  onlyMissing?: boolean;
  filter?: unknown;
  maxBatchSize?: number;
}

export type BackfillRunResult =
  { ok: true; run: BackfillRunProgress } | { ok: false; reason: string };

export interface BackfillPageQuery {
  query: Record<string, unknown>;
  sort: { _id: 1 };
  limit: number;
}

function unexpectedState(state: never): never {
  throw new Error(`Unhandled backfill state: ${String(state)}`);
}

export function isBackfillRunState(value: unknown): value is BackfillRunState {
  return (
    typeof value === 'string' &&
    (BACKFILL_RUN_STATES as readonly string[]).includes(value)
  );
}

export function isLegalBackfillTransition(
  from: BackfillRunState,
  to: BackfillRunState,
): boolean {
  return LEGAL_BACKFILL_TRANSITIONS[from].includes(to);
}

export function isActiveBackfillState(state: BackfillRunState): boolean {
  return ACTIVE_BACKFILL_STATES.includes(state);
}

export function canCancelBackfill(state: BackfillRunState): boolean {
  switch (state) {
    case 'queued':
    case 'running':
      return true;
    case 'completed':
    case 'failed':
    case 'canceled':
      return false;
    default:
      return unexpectedState(state);
  }
}

export function isResumeEligible(state: BackfillRunState): boolean {
  switch (state) {
    case 'failed':
    case 'canceled':
      return true;
    case 'queued':
    case 'running':
    case 'completed':
      return false;
    default:
      return unexpectedState(state);
  }
}

export function boundBackfillBatchSize(
  requested: number | undefined,
  maxBatchSize: number = MAX_BACKFILL_BATCH_SIZE,
): { ok: true; batchSize: number } | { ok: false; reason: 'batch_size' } {
  if (!Number.isInteger(maxBatchSize) || maxBatchSize < MIN_BACKFILL_BATCH_SIZE) {
    return { ok: false, reason: 'batch_size' };
  }
  const cappedMax = Math.min(maxBatchSize, MAX_BACKFILL_BATCH_SIZE);
  const value = requested ?? DEFAULT_BACKFILL_BATCH_SIZE;
  if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value)) {
    return { ok: false, reason: 'batch_size' };
  }
  if (value < MIN_BACKFILL_BATCH_SIZE) {
    return { ok: true, batchSize: MIN_BACKFILL_BATCH_SIZE };
  }
  return { ok: true, batchSize: Math.min(value, cappedMax) };
}

export function boundBackfillPage<T>(docs: readonly T[], batchSize: number): T[] {
  if (!Number.isInteger(batchSize) || batchSize < MIN_BACKFILL_BATCH_SIZE) return [];
  return docs.slice(0, Math.min(batchSize, MAX_BACKFILL_BATCH_SIZE));
}

export function isBackfillPageExhausted(pageLength: number, batchSize: number): boolean {
  return pageLength < batchSize;
}

export function sanitizeBackfillError(err: unknown): string {
  return sanitizeErrorMessage(err).slice(0, MAX_BACKFILL_ERROR_LENGTH);
}

export function createQueuedBackfill(input: CreateBackfillRunInput): BackfillRunResult {
  if (typeof input.schemaName !== 'string' || !SCHEMA_NAME.test(input.schemaName)) {
    return { ok: false, reason: 'schemaName' };
  }
  if (
    input.configId !== undefined &&
    (typeof input.configId !== 'string' || !IDENTITY.test(input.configId))
  ) {
    return { ok: false, reason: 'configId' };
  }
  const bounded = boundBackfillBatchSize(input.batchSize, input.maxBatchSize);
  if (!bounded.ok) return bounded;
  const filter = normalizeFilter(input.filter);
  if (!filter.ok) return filter;
  return {
    ok: true,
    run: {
      state: 'queued',
      schemaName: input.schemaName,
      ...(input.configId ? { configId: input.configId } : {}),
      cursor: null,
      batchSize: bounded.batchSize,
      onlyMissing: input.onlyMissing === true,
      filter: filter.filter,
      scannedCount: 0,
      queuedCount: 0,
      processedCount: 0,
      failedCount: 0,
      startedAt: null,
      finishedAt: null,
      drainStartedAt: null,
      error: null,
    },
  };
}

export function startBackfillRun(
  run: BackfillRunProgress,
  now: Date = new Date(),
): BackfillRunResult {
  return transition(run, 'running', {
    startedAt: run.startedAt ?? now,
    finishedAt: null,
    error: null,
  });
}

export function cancelBackfillRun(
  run: BackfillRunProgress,
  now: Date = new Date(),
): BackfillRunResult {
  if (run.state === 'canceled') {
    return { ok: true, run };
  }
  if (!canCancelBackfill(run.state)) {
    return { ok: false, reason: 'illegal_transition' };
  }
  return transition(run, 'canceled', {
    finishedAt: now,
  });
}

export function failBackfillRun(
  run: BackfillRunProgress,
  err: unknown,
  now: Date = new Date(),
): BackfillRunResult {
  return transition(run, 'failed', {
    finishedAt: now,
    error: sanitizeBackfillError(err),
  });
}

export function completeBackfillRun(
  run: BackfillRunProgress,
  now: Date = new Date(),
): BackfillRunResult {
  return transition(run, 'completed', {
    finishedAt: now,
    error: null,
  });
}

export function resumeBackfillRun(run: BackfillRunProgress): BackfillRunResult {
  if (run.state === 'queued' || run.state === 'running') {
    return { ok: true, run };
  }
  if (!isResumeEligible(run.state)) {
    return { ok: false, reason: 'illegal_transition' };
  }
  return transition(run, 'queued', {
    finishedAt: null,
    error: null,
    drainStartedAt: null,
  });
}

export function applyBackfillPage(
  run: BackfillRunProgress,
  docs: ReadonlyArray<{ _id?: unknown }>,
  queuedDelta: number = docs.length,
): BackfillRunResult & { exhausted?: boolean } {
  if (run.state !== 'running') {
    return { ok: false, reason: 'not_running' };
  }
  if (docs.length > run.batchSize) {
    return { ok: false, reason: 'page_size' };
  }
  if (!Number.isInteger(queuedDelta) || queuedDelta < 0 || queuedDelta > docs.length) {
    return { ok: false, reason: 'queued' };
  }
  const exhausted = isBackfillPageExhausted(docs.length, run.batchSize);
  if (docs.length === 0) {
    return { ok: true, run, exhausted };
  }
  const ids: string[] = [];
  for (const doc of docs) {
    if (typeof doc._id !== 'string' || !IDENTITY.test(doc._id)) {
      return { ok: false, reason: 'cursor' };
    }
    ids.push(doc._id);
  }
  const cursor = ids[ids.length - 1];
  if (run.cursor && cursor === run.cursor) {
    return { ok: false, reason: 'cursor' };
  }
  return {
    ok: true,
    exhausted,
    run: {
      ...run,
      cursor,
      scannedCount: run.scannedCount + docs.length,
      queuedCount: run.queuedCount + queuedDelta,
    },
  };
}

export type BackfillCountIncrementPatch = {
  $inc: { processedCount?: number; failedCount?: number };
};

export function backfillCountIncrementPatch(
  outcome: 'processed' | 'failed',
): BackfillCountIncrementPatch {
  return {
    $inc: outcome === 'processed' ? { processedCount: 1 } : { failedCount: 1 },
  };
}

export function applyAtomicBackfillCountDelta(
  counters: { processedCount: number; failedCount: number },
  outcome: 'processed' | 'failed',
): { processedCount: number; failedCount: number } {
  const patch = backfillCountIncrementPatch(outcome).$inc;
  counters.processedCount += patch.processedCount ?? 0;
  counters.failedCount += patch.failedCount ?? 0;
  return counters;
}

export function applyBackfillJobCounts(
  run: BackfillRunProgress,
  counts: { processed?: number; failed?: number },
): BackfillRunResult {
  if (run.state !== 'running') {
    return { ok: false, reason: 'not_running' };
  }
  const processedDelta = counts.processed ?? 0;
  const failedDelta = counts.failed ?? 0;
  if (
    !Number.isInteger(processedDelta) ||
    processedDelta < 0 ||
    !Number.isInteger(failedDelta) ||
    failedDelta < 0
  ) {
    return { ok: false, reason: 'counts' };
  }
  const processedCount = run.processedCount + processedDelta;
  const failedCount = run.failedCount + failedDelta;
  if (processedCount + failedCount > run.queuedCount) {
    return { ok: false, reason: 'counts' };
  }
  return {
    ok: true,
    run: {
      ...run,
      processedCount,
      failedCount,
    },
  };
}

export function buildBackfillPageQuery(
  run: Pick<BackfillRunProgress, 'cursor' | 'filter' | 'onlyMissing' | 'batchSize'>,
  targetField?: string,
): { ok: true; page: BackfillPageQuery } | { ok: false; reason: string } {
  if (run.onlyMissing) {
    if (typeof targetField !== 'string' || !SCHEMA_NAME.test(targetField)) {
      return { ok: false, reason: 'targetField' };
    }
  }
  const query: Record<string, unknown> = { ...(run.filter ?? {}) };
  delete query._id;
  if (run.onlyMissing && targetField) {
    query[targetField] = null;
  }
  if (run.cursor) {
    if (!IDENTITY.test(run.cursor)) {
      return { ok: false, reason: 'cursor' };
    }
    query._id = { $gt: run.cursor };
  }
  return {
    ok: true,
    page: {
      query,
      sort: { _id: 1 },
      limit: run.batchSize,
    },
  };
}

function transition(
  run: BackfillRunProgress,
  to: BackfillRunState,
  patch: Partial<BackfillRunProgress>,
): BackfillRunResult {
  if (!isLegalBackfillTransition(run.state, to)) {
    return { ok: false, reason: 'illegal_transition' };
  }
  return {
    ok: true,
    run: {
      ...run,
      ...patch,
      state: to,
    },
  };
}

function normalizeFilter(
  filter: unknown,
): { ok: true; filter: Record<string, unknown> | null } | { ok: false; reason: string } {
  if (filter == null) return { ok: true, filter: null };
  if (typeof filter !== 'object' || Array.isArray(filter)) {
    return { ok: false, reason: 'filter' };
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(filter);
  } catch {
    return { ok: false, reason: 'filter' };
  }
  if (serialized.length > MAX_BACKFILL_FILTER_BYTES) {
    return { ok: false, reason: 'filter' };
  }
  if (hasDangerousFilterKey(filter)) {
    return { ok: false, reason: 'filter' };
  }
  return { ok: true, filter: JSON.parse(serialized) as Record<string, unknown> };
}

function hasDangerousFilterKey(value: unknown): boolean {
  if (value == null || typeof value !== 'object') return false;
  if (Array.isArray(value)) {
    return value.some(hasDangerousFilterKey);
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (DANGEROUS_FILTER_KEY.test(key)) return true;
    if (hasDangerousFilterKey(nested)) return true;
  }
  return false;
}
