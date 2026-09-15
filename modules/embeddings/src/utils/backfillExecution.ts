import type { VectorCapabilities } from '@conduitplatform/grpc-sdk';
import {
  applyBackfillPage,
  backfillCountIncrementPatch,
  boundBackfillPage,
  buildBackfillPageQuery,
  cancelBackfillRun,
  completeBackfillRun,
  createQueuedBackfill,
  failBackfillRun,
  isActiveBackfillState,
  resumeBackfillRun,
  startBackfillRun,
  type BackfillCountIncrementPatch,
  type BackfillPageQuery,
  type BackfillRunProgress,
  type BackfillRunResult,
} from './backfillRun.js';
import {
  assertBackfillExecutable,
  BackfillGateError,
  type BackfillConfigGate,
  type VectorIndexGate,
} from './backfillGates.js';
import { EmbeddingJobData, MAX_QUEUE_BATCH_SIZE } from './embeddingJobs.js';
import { incrementEmbeddingMetric } from './embeddingMetrics.js';
import { sanitizeErrorMessage } from './redactConfig.js';

const IDENTITY = /^[A-Za-z0-9._-]{1,128}$/;

export const BACKFILL_DRAIN_DELAY_MS = 1000;
export const DEFAULT_BACKFILL_DRAIN_TIMEOUT_MS = 15 * 60 * 1000;
export const BACKFILL_DRAIN_TIMEOUT_MESSAGE =
  'Backfill drain timed out waiting for generation jobs';

export interface PersistedBackfillRun extends BackfillRunProgress {
  _id: string;
}

export interface BackfillControllerJobData {
  runId: string;
  cursor?: string | null;
  drain?: boolean;
}

export type ParsedBackfillControllerJob =
  { ok: true; data: BackfillControllerJobData } | { ok: false; reason: string };

export interface QueueBackfillInput {
  schemaName: string;
  batchSize?: number;
  configId?: string;
  onlyMissing?: boolean;
  filter?: unknown;
  maxBatchSize?: number;
}

export interface QueueBackfillDeps {
  moduleEnabled: boolean;
  capabilities: Pick<VectorCapabilities, 'supported' | 'storage' | 'provider' | 'reason'>;
  configs: BackfillConfigGate[];
  indexes: readonly VectorIndexGate[];
  createRun: (run: BackfillRunProgress) => Promise<{ _id: string }>;
  saveRun: (id: string, run: BackfillRunProgress) => Promise<void>;
  findActiveRuns: (configId: string) => Promise<PersistedBackfillRun[]>;
  enqueueController: (job: BackfillControllerJobData) => Promise<void>;
}

export interface ProcessBackfillDeps {
  now?: Date;
  maxBatchSize: number;
  moduleEnabled: boolean;
  getRun: (id: string) => Promise<PersistedBackfillRun | null>;
  saveRun: (id: string, run: BackfillRunProgress) => Promise<void>;
  findPage: (
    schemaName: string,
    page: BackfillPageQuery,
  ) => Promise<Array<{ _id?: unknown }>>;
  enqueueEmbeddingJobs: (jobs: EmbeddingJobData[]) => Promise<number>;
  enqueueContinuation: (job: BackfillControllerJobData) => Promise<void>;
  getCapabilities: (
    schemaName: string,
  ) => Promise<Pick<VectorCapabilities, 'supported' | 'storage' | 'provider' | 'reason'>>;
  getConfig: (id: string) => Promise<BackfillConfigGate | null>;
  getIndexes: (schemaName: string) => Promise<readonly VectorIndexGate[]>;
  drainTimeoutMs?: number;
}

export function backfillRunFromDocument(doc: {
  _id: string;
  schemaName: string;
  configId?: string;
  state: BackfillRunProgress['state'];
  cursor?: string;
  batchSize: number;
  onlyMissing?: boolean;
  filter?: Record<string, unknown>;
  scannedCount?: number;
  queuedCount?: number;
  processedCount?: number;
  failedCount?: number;
  startedAt?: Date;
  finishedAt?: Date;
  drainStartedAt?: Date;
  error?: string;
}): PersistedBackfillRun {
  return {
    _id: doc._id,
    state: doc.state,
    schemaName: doc.schemaName,
    ...(doc.configId ? { configId: doc.configId } : {}),
    cursor: doc.cursor ?? null,
    batchSize: doc.batchSize,
    onlyMissing: doc.onlyMissing === true,
    filter: doc.filter ?? null,
    scannedCount: doc.scannedCount ?? 0,
    queuedCount: doc.queuedCount ?? 0,
    processedCount: doc.processedCount ?? 0,
    failedCount: doc.failedCount ?? 0,
    startedAt: doc.startedAt ?? null,
    finishedAt: doc.finishedAt ?? null,
    drainStartedAt: doc.drainStartedAt ?? null,
    error: doc.error ?? null,
  };
}

export function persistableBackfillRun(
  run: BackfillRunProgress,
): Record<string, unknown> {
  return {
    state: run.state,
    schemaName: run.schemaName,
    configId: run.configId,
    cursor: run.cursor ?? undefined,
    batchSize: run.batchSize,
    onlyMissing: run.onlyMissing,
    filter: run.filter ?? undefined,
    scannedCount: run.scannedCount,
    queuedCount: run.queuedCount,
    startedAt: run.startedAt ?? undefined,
    finishedAt: run.finishedAt ?? undefined,
    drainStartedAt: run.drainStartedAt ?? undefined,
    error: run.error ?? undefined,
  };
}

export function persistableNewBackfillRun(
  run: BackfillRunProgress,
): Record<string, unknown> {
  return {
    ...persistableBackfillRun(run),
    processedCount: run.processedCount,
    failedCount: run.failedCount,
  };
}

export function parseBackfillControllerJob(value: unknown): ParsedBackfillControllerJob {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, reason: 'malformed' };
  }
  const record = value as Record<string, unknown>;
  const extraKeys = Object.keys(record).filter(
    key => !['runId', 'cursor', 'drain'].includes(key),
  );
  if (extraKeys.length) return { ok: false, reason: 'malformed' };
  if (typeof record.runId !== 'string' || !IDENTITY.test(record.runId)) {
    return { ok: false, reason: 'runId' };
  }
  if (record.drain !== undefined && typeof record.drain !== 'boolean') {
    return { ok: false, reason: 'drain' };
  }
  if (
    record.cursor != null &&
    (typeof record.cursor !== 'string' || !IDENTITY.test(record.cursor))
  ) {
    return { ok: false, reason: 'cursor' };
  }
  return {
    ok: true,
    data: {
      runId: record.runId,
      cursor: record.cursor ?? null,
      ...(record.drain === true ? { drain: true } : {}),
    },
  };
}

export function selectedBackfillConfigs(
  configs: BackfillConfigGate[],
  configId?: string,
): BackfillConfigGate[] {
  if (configId) {
    return configs.filter(config => config._id === configId);
  }
  return configs.filter(config => config.enabled !== false && config._id);
}

export async function queueBackfillRuns(
  input: QueueBackfillInput,
  deps: QueueBackfillDeps,
): Promise<{
  queued: number;
  runs: Array<{ id: string; configId?: string; state: string }>;
}> {
  const selected = selectedBackfillConfigs(deps.configs, input.configId);
  if (!selected.length) {
    assertBackfillExecutable({
      moduleEnabled: deps.moduleEnabled,
      capabilities: deps.capabilities,
      config: null,
      indexes: deps.indexes,
    });
  }
  for (const config of selected) {
    assertBackfillExecutable({
      moduleEnabled: deps.moduleEnabled,
      capabilities: deps.capabilities,
      config,
      indexes: deps.indexes,
    });
  }
  const runs: Array<{ id: string; configId?: string; state: string }> = [];
  for (const config of selected) {
    const created = createQueuedBackfill({
      schemaName: input.schemaName,
      configId: config._id,
      batchSize: input.batchSize,
      onlyMissing: input.onlyMissing,
      filter: input.filter,
      maxBatchSize: input.maxBatchSize,
    });
    if (!created.ok) {
      throw new BackfillGateError(
        'config_not_found',
        `Invalid backfill request: ${created.reason}`,
      );
    }
    if (config._id) {
      const active = (await deps.findActiveRuns(config._id)).filter(run =>
        isActiveBackfillState(run.state),
      );
      const existing = active[0];
      if (existing) {
        if (existing.state === 'queued') {
          await enqueueOrFailRun(
            existing._id,
            existing,
            deps.saveRun,
            deps.enqueueController,
            {
              runId: existing._id,
              cursor: existing.cursor ?? null,
            },
          );
        }
        runs.push({
          id: existing._id,
          ...(config._id ? { configId: config._id } : {}),
          state: existing.state,
        });
        continue;
      }
    }
    const persisted = await deps.createRun(created.run);
    const queuedRun: PersistedBackfillRun = { ...created.run, _id: persisted._id };
    await enqueueOrFailRun(
      persisted._id,
      queuedRun,
      deps.saveRun,
      deps.enqueueController,
      {
        runId: persisted._id,
        cursor: null,
      },
    );
    runs.push({
      id: persisted._id,
      ...(config._id ? { configId: config._id } : {}),
      state: created.run.state,
    });
  }
  return { queued: runs.length, runs };
}

async function enqueueOrFailRun(
  id: string,
  run: BackfillRunProgress,
  saveRun: (id: string, run: BackfillRunProgress) => Promise<void>,
  enqueue: (job: BackfillControllerJobData) => Promise<void>,
  job: BackfillControllerJobData,
): Promise<void> {
  try {
    await enqueue(job);
  } catch (err) {
    const failed = failBackfillRun(run, sanitizeErrorMessage(err));
    if (failed.ok) {
      await saveRun(id, failed.run);
    }
    throw err;
  }
}

export async function resumeBackfillExecution(args: {
  run: PersistedBackfillRun;
  saveRun: (id: string, run: BackfillRunProgress) => Promise<void>;
  enqueueController: (job: BackfillControllerJobData) => Promise<void>;
}): Promise<BackfillRunResult> {
  const resumed = resumeBackfillRun(args.run);
  if (!resumed.ok) return resumed;
  await args.saveRun(args.run._id, resumed.run);
  try {
    await args.enqueueController({
      runId: args.run._id,
      cursor: resumed.run.cursor ?? null,
    });
  } catch (err) {
    const failed = failBackfillRun(resumed.run, sanitizeErrorMessage(err));
    if (failed.ok) {
      await args.saveRun(args.run._id, failed.run);
    }
    throw err;
  }
  return resumed;
}

export async function cancelBackfillExecution(args: {
  run: PersistedBackfillRun;
  saveRun: (id: string, run: BackfillRunProgress) => Promise<void>;
  now?: Date;
}): Promise<BackfillRunResult> {
  const canceled = cancelBackfillRun(args.run, args.now);
  if (!canceled.ok) return canceled;
  await args.saveRun(args.run._id, canceled.run);
  return canceled;
}

export async function applyBackfillJobOutcome(args: {
  runId: string;
  outcome: 'processed' | 'failed';
  incrementCounts: (
    id: string,
    patch: BackfillCountIncrementPatch,
  ) => Promise<BackfillRunProgress | null>;
}): Promise<BackfillRunResult> {
  const run = await args.incrementCounts(
    args.runId,
    backfillCountIncrementPatch(args.outcome),
  );
  if (!run) return { ok: false, reason: 'not_found' };
  return { ok: true, run };
}

export async function processBackfillControllerJob(
  rawJob: unknown,
  deps: ProcessBackfillDeps,
): Promise<{ action: string; run?: BackfillRunProgress }> {
  const parsed = parseBackfillControllerJob(rawJob);
  if (!parsed.ok) {
    incrementEmbeddingMetric('malformedJobs');
    return { action: 'malformed' };
  }
  const persisted = await deps.getRun(parsed.data.runId);
  if (!persisted) {
    return { action: 'missing' };
  }
  if (persisted.state === 'canceled' || persisted.state === 'completed') {
    return { action: persisted.state, run: persisted };
  }
  if (parsed.data.drain) {
    return drainBackfill(persisted, deps);
  }
  return scanBackfillPage(parsed.data, persisted, deps);
}

async function startQueuedBackfill(
  persisted: PersistedBackfillRun,
  deps: ProcessBackfillDeps,
  now: Date,
): Promise<{ action: string; run?: BackfillRunProgress } | { run: BackfillRunProgress }> {
  let run: BackfillRunProgress = persisted;
  if (run.state === 'queued') {
    const started = startBackfillRun(run, now);
    if (!started.ok) return { action: started.reason, run };
    run = started.run;
    await deps.saveRun(persisted._id, run);
  }
  if (run.state !== 'running') {
    return { action: run.state, run };
  }
  return { run };
}

async function rescheduleStaleBackfill(
  persisted: PersistedBackfillRun,
  run: BackfillRunProgress,
  job: BackfillControllerJobData,
  deps: ProcessBackfillDeps,
): Promise<{ action: string; run: BackfillRunProgress } | undefined> {
  const jobCursor = job.cursor ?? null;
  const runCursor = run.cursor ?? null;
  if (jobCursor === runCursor) return undefined;
  await deps.enqueueContinuation({
    runId: persisted._id,
    cursor: runCursor,
  });
  return { action: 'stale', run };
}

function pageEmbeddingJobs(
  run: BackfillRunProgress,
  persistedId: string,
  docs: Array<{ _id?: unknown }>,
  maxBatchSize: number,
): EmbeddingJobData[] {
  return docs
    .map(doc => ({
      schemaName: run.schemaName,
      documentId: String(doc._id),
      ...(run.configId ? { configId: run.configId } : {}),
      backfillRunId: persistedId,
    }))
    .slice(0, Math.min(run.batchSize, maxBatchSize, MAX_QUEUE_BATCH_SIZE));
}

async function scanBackfillPage(
  job: BackfillControllerJobData,
  persisted: PersistedBackfillRun,
  deps: ProcessBackfillDeps,
): Promise<{ action: string; run?: BackfillRunProgress }> {
  const now = deps.now ?? new Date();
  const started = await startQueuedBackfill(persisted, deps, now);
  if ('action' in started) return started;
  let run = started.run;
  const stale = await rescheduleStaleBackfill(persisted, run, job, deps);
  if (stale) return stale;

  try {
    if (!run.configId) {
      throw new BackfillGateError(
        'config_not_found',
        'Backfill run is missing a config id',
      );
    }
    const config = await deps.getConfig(run.configId);
    assertBackfillExecutable({
      moduleEnabled: deps.moduleEnabled,
      capabilities: await deps.getCapabilities(run.schemaName),
      config,
      indexes: await deps.getIndexes(run.schemaName),
    });
    const pageQuery = buildBackfillPageQuery(run, config?.targetField);
    if (!pageQuery.ok) {
      throw new BackfillGateError(
        'config_not_found',
        `Invalid backfill page: ${pageQuery.reason}`,
      );
    }
    const docs = boundBackfillPage(
      await deps.findPage(run.schemaName, pageQuery.page),
      run.batchSize,
    );
    const jobs = pageEmbeddingJobs(run, persisted._id, docs, deps.maxBatchSize);
    const queuedDelta = jobs.length ? await deps.enqueueEmbeddingJobs(jobs) : 0;
    incrementEmbeddingMetric('backfill', queuedDelta);
    const applied = applyBackfillPage(
      run,
      docs.map(doc => ({ _id: String(doc._id) })),
      queuedDelta,
    );
    if (!applied.ok) {
      return failPersistedRun(persisted._id, run, applied.reason, deps, now);
    }
    run = applied.run;
    await deps.saveRun(persisted._id, run);
    const canceled = await deps.getRun(persisted._id);
    if (!canceled || canceled.state === 'canceled') {
      return { action: 'canceled', run: canceled ?? run };
    }
    if (applied.exhausted) {
      return finishOrDrain(persisted._id, run, deps, now);
    }
    await deps.enqueueContinuation({
      runId: persisted._id,
      cursor: run.cursor ?? null,
    });
    return { action: 'continue', run };
  } catch (err) {
    return failPersistedRun(persisted._id, run, err, deps, now);
  }
}

async function drainBackfill(
  persisted: PersistedBackfillRun,
  deps: ProcessBackfillDeps,
): Promise<{ action: string; run?: BackfillRunProgress }> {
  const latest = (await deps.getRun(persisted._id)) ?? persisted;
  if (latest.state === 'canceled') {
    return { action: 'canceled', run: latest };
  }
  if (latest.state !== 'running') {
    return { action: latest.state, run: latest };
  }
  return finishOrDrain(latest._id, latest, deps, deps.now ?? new Date());
}

async function finishOrDrain(
  id: string,
  run: BackfillRunProgress,
  deps: ProcessBackfillDeps,
  now: Date,
): Promise<{ action: string; run?: BackfillRunProgress }> {
  if (run.processedCount + run.failedCount >= run.queuedCount) {
    const completed = completeBackfillRun(run, now);
    if (!completed.ok) return { action: completed.reason, run };
    await deps.saveRun(id, completed.run);
    return { action: 'completed', run: completed.run };
  }
  const drainStartedAt = run.drainStartedAt ?? now;
  const timeoutMs = deps.drainTimeoutMs ?? DEFAULT_BACKFILL_DRAIN_TIMEOUT_MS;
  if (now.getTime() - drainStartedAt.getTime() >= timeoutMs) {
    return failPersistedRun(id, run, BACKFILL_DRAIN_TIMEOUT_MESSAGE, deps, now);
  }
  if (!run.drainStartedAt) {
    run = { ...run, drainStartedAt };
    await deps.saveRun(id, run);
  }
  await deps.enqueueContinuation({
    runId: id,
    cursor: run.cursor ?? null,
    drain: true,
  });
  return { action: 'drain', run };
}

async function failPersistedRun(
  id: string,
  run: BackfillRunProgress,
  err: unknown,
  deps: ProcessBackfillDeps,
  now: Date,
): Promise<{ action: string; run?: BackfillRunProgress }> {
  const failed = failBackfillRun(run, err, now);
  if (!failed.ok) return { action: failed.reason, run };
  await deps.saveRun(id, failed.run);
  return { action: 'failed', run: failed.run };
}
