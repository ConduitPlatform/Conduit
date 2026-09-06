import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorIndexStatus } from '@conduitplatform/grpc-sdk';
import {
  applyBackfillJobOutcome,
  backfillRunFromDocument,
  cancelBackfillExecution,
  parseBackfillControllerJob,
  persistableBackfillRun,
  persistableNewBackfillRun,
  processBackfillControllerJob,
  queueBackfillRuns,
  resumeBackfillExecution,
  type BackfillControllerJobData,
  type PersistedBackfillRun,
  type ProcessBackfillDeps,
} from './backfillExecution.js';
import { BackfillGateError } from './backfillGates.js';
import type { EmbeddingJobData } from './embeddingJobs.js';
import type { BackfillRunProgress } from './backfillRun.js';

const now = new Date('2026-09-06T18:00:00.000Z');
const capabilities = {
  supported: true,
  storage: true,
  provider: 'mongodb' as const,
};
const config = {
  _id: 'cfg1',
  enabled: true,
  schemaName: 'Article',
  targetField: 'embedding',
  dimensions: 3,
  similarity: 'cosine',
};
const readyIndex = {
  field: 'embedding',
  name: 'embedding_vector',
  status: VectorIndexStatus.Ready,
  queryable: true,
  dimensions: 3,
  similarity: 'cosine',
};

function memoryStore(initial: PersistedBackfillRun[] = []) {
  const runs = new Map<string, PersistedBackfillRun>(
    initial.map(run => [run._id, { ...run }]),
  );
  return {
    runs,
    createRun: async (run: BackfillRunProgress) => {
      const created: PersistedBackfillRun = { ...run, _id: `run${runs.size + 1}` };
      runs.set(created._id, created);
      return { _id: created._id };
    },
    getRun: async (id: string) => {
      const run = runs.get(id);
      return run ? { ...run } : null;
    },
    saveRun: async (id: string, run: BackfillRunProgress) => {
      const existing = runs.get(id);
      if (!existing) {
        runs.set(id, {
          ...run,
          ...persistableNewBackfillRun(run),
          _id: id,
        } as PersistedBackfillRun);
        return;
      }
      Object.assign(existing, persistableBackfillRun(run));
    },
    incrementCounts: async (
      id: string,
      patch: { $inc: { processedCount?: number; failedCount?: number } },
    ) => {
      const run = runs.get(id);
      if (!run || run.state !== 'running') return null;
      run.processedCount += patch.$inc.processedCount ?? 0;
      run.failedCount += patch.$inc.failedCount ?? 0;
      return { ...run };
    },
  };
}

function deps(
  overrides: Partial<ProcessBackfillDeps> & { store: ReturnType<typeof memoryStore> },
): ProcessBackfillDeps {
  const pages: Array<{ _id: string }>[] = overrides.findPage
    ? []
    : [[{ _id: 'a' }, { _id: 'b' }], [{ _id: 'c' }]];
  let page = 0;
  const embeddingJobs: EmbeddingJobData[] = [];
  const continuations: BackfillControllerJobData[] = [];
  return {
    now,
    maxBatchSize: 500,
    moduleEnabled: true,
    getRun: overrides.store.getRun,
    saveRun: overrides.store.saveRun,
    findPage: async () => pages[page++] ?? [],
    enqueueEmbeddingJobs: async jobs => {
      embeddingJobs.push(...jobs);
      return jobs.length;
    },
    enqueueContinuation: async job => {
      continuations.push(job);
    },
    getCapabilities: async () => capabilities,
    getConfig: async id => (id === config._id ? config : null),
    getIndexes: async () => [readyIndex],
    ...overrides,
    embeddingJobs,
    continuations,
  } as ProcessBackfillDeps & {
    embeddingJobs: EmbeddingJobData[];
    continuations: BackfillControllerJobData[];
  };
}

describe('queued backfill start', () => {
  it('persists queued config-specific runs and enqueues controller jobs without scanning', async () => {
    const store = memoryStore();
    const controllerJobs: BackfillControllerJobData[] = [];
    const queued = await queueBackfillRuns(
      { schemaName: 'Article', batchSize: 2, onlyMissing: true },
      {
        moduleEnabled: true,
        capabilities,
        configs: [config, { ...config, _id: 'cfg2', targetField: 'other' }],
        indexes: [readyIndex, { ...readyIndex, field: 'other', name: 'other_vector' }],
        createRun: store.createRun,
        saveRun: store.saveRun,
        findActiveRuns: async configId =>
          [...store.runs.values()].filter(
            run =>
              run.configId === configId &&
              (run.state === 'queued' || run.state === 'running'),
          ),
        enqueueController: async job => {
          controllerJobs.push(job);
        },
      },
    );
    assert.equal(queued.queued, 2);
    assert.equal(queued.runs[0].state, 'queued');
    assert.equal(queued.runs[0].configId, 'cfg1');
    assert.equal(queued.runs[1].configId, 'cfg2');
    assert.deepEqual(
      controllerJobs.map(job => job.runId),
      queued.runs.map(run => run.id),
    );
    const persisted = [...store.runs.values()];
    assert.equal(
      persisted.every(run => run.state === 'queued'),
      true,
    );
    assert.equal(
      persisted.every(run => run.scannedCount === 0),
      true,
    );
    assert.equal(
      persisted.every(run => run.onlyMissing === true),
      true,
    );
  });

  it('fails closed before persisting when a gate is not met', async () => {
    const store = memoryStore();
    await assert.rejects(
      () =>
        queueBackfillRuns(
          { schemaName: 'Article' },
          {
            moduleEnabled: false,
            capabilities,
            configs: [config],
            indexes: [readyIndex],
            createRun: store.createRun,
            saveRun: store.saveRun,
            findActiveRuns: async () => [],
            enqueueController: async () => undefined,
          },
        ),
      (err: unknown) =>
        err instanceof BackfillGateError && err.reason === 'module_disabled',
    );
    assert.equal(store.runs.size, 0);
  });
});

describe('cursor-based backfill continuation', () => {
  it('scans bounded pages, caps enqueue, and continues from the cursor', async () => {
    const store = memoryStore();
    const created = await store.createRun(
      backfillRunFromDocument({
        _id: 'ignored',
        schemaName: 'Article',
        configId: 'cfg1',
        state: 'queued',
        batchSize: 2,
        onlyMissing: false,
        scannedCount: 0,
        queuedCount: 0,
        processedCount: 0,
        failedCount: 0,
      }),
    );
    const harness = deps({
      store,
      findPage: async (_schema, page) => {
        if (page.query._id) return [{ _id: 'c' }];
        return [{ _id: 'a' }, { _id: 'b' }, { _id: 'extra' }];
      },
    }) as ProcessBackfillDeps & {
      embeddingJobs: EmbeddingJobData[];
      continuations: BackfillControllerJobData[];
    };

    const first = await processBackfillControllerJob(
      { runId: created._id, cursor: null },
      harness,
    );
    assert.equal(first.action, 'continue');
    assert.equal(first.run?.state, 'running');
    assert.equal(first.run?.cursor, 'b');
    assert.equal(first.run?.scannedCount, 2);
    assert.equal(first.run?.queuedCount, 2);
    assert.equal(harness.embeddingJobs.length, 2);
    assert.equal(harness.embeddingJobs[0].configId, 'cfg1');
    assert.equal(harness.embeddingJobs[0].backfillRunId, created._id);
    assert.deepEqual(harness.continuations, [{ runId: created._id, cursor: 'b' }]);

    const second = await processBackfillControllerJob(harness.continuations[0], {
      ...harness,
      enqueueContinuation: async job => {
        harness.continuations.push(job);
      },
    });
    assert.equal(second.action, 'drain');
    assert.equal(second.run?.cursor, 'c');
    assert.equal(second.run?.scannedCount, 3);
    assert.equal(second.run?.queuedCount, 3);
    assert.equal(second.run?.state, 'running');
    for (let i = 0; i < 3; i += 1) {
      await applyBackfillJobOutcome({
        runId: created._id,
        outcome: 'processed',
        incrementCounts: store.incrementCounts,
      });
    }
    const drained = await processBackfillControllerJob(
      { runId: created._id, cursor: 'c', drain: true },
      harness,
    );
    assert.equal(drained.action, 'completed');
    assert.equal(drained.run?.processedCount, 3);
  });

  it('uses onlyMissing target-field queries and config-specific jobs', async () => {
    const store = memoryStore();
    const created = await store.createRun(
      backfillRunFromDocument({
        _id: 'ignored',
        schemaName: 'Article',
        configId: 'cfg1',
        state: 'queued',
        batchSize: 1,
        onlyMissing: true,
      }),
    );
    let observedQuery: Record<string, unknown> | undefined;
    const harness = deps({
      store,
      findPage: async (_schema, page) => {
        observedQuery = page.query;
        return [{ _id: 'a' }];
      },
    }) as ProcessBackfillDeps & { embeddingJobs: EmbeddingJobData[] };
    await processBackfillControllerJob({ runId: created._id, cursor: null }, harness);
    assert.equal(observedQuery?.embedding, null);
    assert.equal(harness.embeddingJobs[0]?.configId, 'cfg1');
  });
});

describe('backfill cancellation, resume, and counters', () => {
  it('stops at cancellation checks and resumes from the saved cursor', async () => {
    const store = memoryStore();
    const created = await store.createRun(
      backfillRunFromDocument({
        _id: 'ignored',
        schemaName: 'Article',
        configId: 'cfg1',
        state: 'queued',
        batchSize: 2,
      }),
    );
    const first = deps({ store });
    await processBackfillControllerJob({ runId: created._id, cursor: null }, first);
    const running = (await store.getRun(created._id))!;
    const canceled = await cancelBackfillExecution({
      run: running,
      saveRun: store.saveRun,
      now,
    });
    assert.equal(canceled.ok, true);
    const canceledProcess = await processBackfillControllerJob(
      { runId: created._id, cursor: 'b' },
      deps({ store }),
    );
    assert.equal(canceledProcess.action, 'canceled');

    const resumed = await resumeBackfillExecution({
      run: (await store.getRun(created._id))!,
      saveRun: store.saveRun,
      enqueueController: async () => undefined,
    });
    assert.equal(resumed.ok, true);
    if (!resumed.ok) return;
    assert.equal(resumed.run.state, 'queued');
    assert.equal(resumed.run.cursor, 'b');

    let query: Record<string, unknown> | undefined;
    const restarted = await processBackfillControllerJob(
      { runId: created._id, cursor: 'b' },
      deps({
        store,
        findPage: async (_schema, page) => {
          query = page.query;
          return [{ _id: 'c' }];
        },
      }),
    );
    assert.deepEqual(query?._id, { $gt: 'b' });
    assert.equal(restarted.run?.cursor, 'c');
    assert.equal(restarted.run?.state, 'running');
    assert.equal(restarted.run?.startedAt?.toISOString(), now.toISOString());
  });

  it('persists processed and failed job counts without exceeding queued work', async () => {
    const store = memoryStore();
    const created = await store.createRun(
      backfillRunFromDocument({
        _id: 'ignored',
        schemaName: 'Article',
        configId: 'cfg1',
        state: 'queued',
        batchSize: 2,
      }),
    );
    await processBackfillControllerJob(
      { runId: created._id, cursor: null },
      deps({ store }),
    );
    const afterPage = (await store.getRun(created._id))!;
    const processed = await applyBackfillJobOutcome({
      runId: created._id,
      outcome: 'processed',
      incrementCounts: store.incrementCounts,
    });
    assert.equal(processed.ok, true);
    const failed = await applyBackfillJobOutcome({
      runId: created._id,
      outcome: 'failed',
      incrementCounts: store.incrementCounts,
    });
    assert.equal(failed.ok, true);
    if (!failed.ok) return;
    assert.equal(failed.run.scannedCount, 2);
    assert.equal(failed.run.queuedCount, 2);
    assert.equal(failed.run.processedCount, 1);
    assert.equal(failed.run.failedCount, 1);
  });

  it('keeps concurrent processed and failed increments without lost updates', async () => {
    const store = memoryStore();
    const created = await store.createRun(
      backfillRunFromDocument({
        _id: 'ignored',
        schemaName: 'Article',
        configId: 'cfg1',
        state: 'running',
        batchSize: 2,
        queuedCount: 40,
      }),
    );
    await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        applyBackfillJobOutcome({
          runId: created._id,
          outcome: index % 5 === 0 ? 'failed' : 'processed',
          incrementCounts: async (id, patch) => {
            await Promise.resolve();
            return store.incrementCounts(id, patch);
          },
        }),
      ),
    );
    const latest = (await store.getRun(created._id))!;
    assert.equal(latest.processedCount, 32);
    assert.equal(latest.failedCount, 8);
  });

  it('does not overwrite atomic processed/failed counts when a page save races with workers', async () => {
    const store = memoryStore();
    const created = await store.createRun(
      backfillRunFromDocument({
        _id: 'ignored',
        schemaName: 'Article',
        configId: 'cfg1',
        state: 'running',
        batchSize: 2,
        queuedCount: 0,
      }),
    );
    const originalSave = store.saveRun;
    store.saveRun = async (id, run) => {
      await Promise.resolve();
      await originalSave(id, run);
    };
    const page = processBackfillControllerJob(
      { runId: created._id, cursor: null },
      deps({
        store,
        findPage: async () => {
          await Promise.resolve();
          return [{ _id: 'a' }, { _id: 'b' }];
        },
      }),
    );
    const workers = Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        applyBackfillJobOutcome({
          runId: created._id,
          outcome: index % 2 === 0 ? 'processed' : 'failed',
          incrementCounts: async (id, patch) => {
            await Promise.resolve();
            return store.incrementCounts(id, patch);
          },
        }),
      ),
    );
    await Promise.all([page, workers]);
    const latest = (await store.getRun(created._id))!;
    assert.equal(latest.processedCount, 5);
    assert.equal(latest.failedCount, 5);
    assert.equal(latest.scannedCount, 2);
    assert.equal(latest.queuedCount, 2);
    assert.equal(latest.cursor, 'b');
  });

  it('fails the running run when the vector index is not queryable', async () => {
    const store = memoryStore();
    const created = await store.createRun(
      backfillRunFromDocument({
        _id: 'ignored',
        schemaName: 'Article',
        configId: 'cfg1',
        state: 'queued',
        batchSize: 1,
      }),
    );
    const result = await processBackfillControllerJob(
      { runId: created._id, cursor: null },
      deps({
        store,
        getIndexes: async () => [
          {
            field: 'embedding',
            status: VectorIndexStatus.Pending,
            queryable: false,
          },
        ],
      }),
    );
    assert.equal(result.action, 'failed');
    assert.equal(result.run?.state, 'failed');
    assert.match(result.run?.error ?? '', /not queryable/);
    assert.doesNotMatch(result.run?.error ?? '', /apiKey|Bearer /);
  });
});

describe('backfill controller job parsing and persistence mapping', () => {
  it('rejects malformed controller payloads and round-trips run documents', () => {
    assert.equal(parseBackfillControllerJob({ runId: 'run1', cursor: null }).ok, true);
    assert.equal(parseBackfillControllerJob({ runId: '../nope' }).ok, false);
    assert.equal(parseBackfillControllerJob({ runId: 'run1', extra: true }).ok, false);
    const progress = backfillRunFromDocument({
      _id: 'run1',
      schemaName: 'Article',
      configId: 'cfg1',
      state: 'queued',
      batchSize: 10,
      onlyMissing: true,
    });
    assert.equal(progress.cursor, null);
    assert.equal(persistableBackfillRun(progress).onlyMissing, true);
    assert.equal('processedCount' in persistableBackfillRun(progress), false);
    assert.equal('failedCount' in persistableBackfillRun(progress), false);
    assert.equal(persistableNewBackfillRun(progress).processedCount, 0);
    assert.equal(persistableNewBackfillRun(progress).failedCount, 0);
  });
});

describe('backfill enqueue failures, drain timeout, and start idempotency', () => {
  function queueDeps(
    store: ReturnType<typeof memoryStore>,
    extras: {
      enqueue?: (job: BackfillControllerJobData) => Promise<void>;
      configs?: Array<{
        _id: string;
        enabled?: boolean;
        schemaName?: string;
        targetField?: string;
      }>;
    } = {},
  ) {
    return {
      moduleEnabled: true,
      capabilities,
      configs: extras.configs ?? [config],
      indexes: [readyIndex],
      createRun: store.createRun,
      saveRun: store.saveRun,
      findActiveRuns: async (configId: string) =>
        [...store.runs.values()].filter(
          run =>
            run.configId === configId &&
            (run.state === 'queued' || run.state === 'running'),
        ),
      enqueueController: extras.enqueue ?? (async () => undefined),
    };
  }

  it('fails a newly created run when controller enqueue throws instead of leaving it queued', async () => {
    const store = memoryStore();
    await assert.rejects(
      () =>
        queueBackfillRuns(
          { schemaName: 'Article' },
          queueDeps(store, {
            enqueue: async () => {
              throw new Error('redis down apiKey=sk-secret');
            },
          }),
        ),
      /redis down/,
    );
    const persisted = [...store.runs.values()];
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0].state, 'failed');
    assert.match(persisted[0].error ?? '', /redis down/);
    assert.doesNotMatch(persisted[0].error ?? '', /sk-secret/);
  });

  it('reuses an active run for the same config instead of creating a duplicate', async () => {
    const store = memoryStore();
    const first = await queueBackfillRuns(
      { schemaName: 'Article', batchSize: 2 },
      queueDeps(store),
    );
    const second = await queueBackfillRuns(
      { schemaName: 'Article', batchSize: 50 },
      queueDeps(store),
    );
    assert.equal(first.queued, 1);
    assert.equal(second.queued, 1);
    assert.equal(second.runs[0].id, first.runs[0].id);
    assert.equal(store.runs.size, 1);
  });

  it('fails drain polling with a sanitized timeout instead of looping forever', async () => {
    const store = memoryStore();
    const created = await store.createRun(
      backfillRunFromDocument({
        _id: 'ignored',
        schemaName: 'Article',
        configId: 'cfg1',
        state: 'running',
        batchSize: 2,
        queuedCount: 2,
        processedCount: 0,
        failedCount: 0,
        scannedCount: 2,
        cursor: 'b',
        drainStartedAt: new Date('2026-09-06T17:00:00.000Z'),
      }),
    );
    const result = await processBackfillControllerJob(
      { runId: created._id, cursor: 'b', drain: true },
      deps({
        store,
        drainTimeoutMs: 60_000,
        now: new Date('2026-09-06T18:00:00.000Z'),
      }),
    );
    assert.equal(result.action, 'failed');
    assert.equal(result.run?.state, 'failed');
    assert.match(result.run?.error ?? '', /timed out waiting for generation jobs/);
    assert.doesNotMatch(result.run?.error ?? '', /apiKey|Bearer /);
  });

  it('records drainStartedAt on the first drain poll then fails after the timeout', async () => {
    const store = memoryStore();
    const created = await store.createRun(
      backfillRunFromDocument({
        _id: 'ignored',
        schemaName: 'Article',
        configId: 'cfg1',
        state: 'running',
        batchSize: 2,
        queuedCount: 2,
        processedCount: 0,
        failedCount: 0,
        scannedCount: 2,
        cursor: 'b',
      }),
    );
    const startedAt = new Date('2026-09-06T18:00:00.000Z');
    const first = await processBackfillControllerJob(
      { runId: created._id, cursor: 'b', drain: true },
      deps({
        store,
        drainTimeoutMs: 60_000,
        now: startedAt,
      }),
    );
    assert.equal(first.action, 'drain');
    assert.equal(first.run?.drainStartedAt?.toISOString(), startedAt.toISOString());
    const timedOut = await processBackfillControllerJob(
      { runId: created._id, cursor: 'b', drain: true },
      deps({
        store,
        drainTimeoutMs: 60_000,
        now: new Date('2026-09-06T18:01:00.000Z'),
      }),
    );
    assert.equal(timedOut.action, 'failed');
    assert.match(timedOut.run?.error ?? '', /timed out waiting for generation jobs/);
  });

  it('fails a resumed run when controller enqueue throws', async () => {
    const store = memoryStore();
    const created = await store.createRun(
      backfillRunFromDocument({
        _id: 'ignored',
        schemaName: 'Article',
        configId: 'cfg1',
        state: 'canceled',
        batchSize: 2,
        cursor: 'b',
      }),
    );
    const existing = (await store.getRun(created._id))!;
    await assert.rejects(
      () =>
        resumeBackfillExecution({
          run: existing,
          saveRun: store.saveRun,
          enqueueController: async () => {
            throw new Error('queue unavailable Bearer sk-secret');
          },
        }),
      /queue unavailable/,
    );
    const persisted = (await store.getRun(created._id))!;
    assert.equal(persisted.state, 'failed');
    assert.doesNotMatch(persisted.error ?? '', /sk-secret/);
  });
});
