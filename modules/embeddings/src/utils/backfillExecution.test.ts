import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorIndexStatus } from '@conduitplatform/grpc-sdk';
import {
  applyBackfillJobOutcome,
  backfillRunFromDocument,
  cancelBackfillExecution,
  parseBackfillControllerJob,
  persistableBackfillRun,
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
};
const readyIndex = {
  field: 'embedding',
  name: 'embedding_vector',
  status: VectorIndexStatus.Ready,
  queryable: true,
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
      runs.set(id, { ...run, _id: id });
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
        run: (await store.getRun(created._id))!,
        outcome: 'processed',
        saveRun: store.saveRun,
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
      run: afterPage,
      outcome: 'processed',
      saveRun: store.saveRun,
    });
    assert.equal(processed.ok, true);
    const failed = await applyBackfillJobOutcome({
      run: (await store.getRun(created._id))!,
      outcome: 'failed',
      saveRun: store.saveRun,
    });
    assert.equal(failed.ok, true);
    if (!failed.ok) return;
    assert.equal(failed.run.scannedCount, 2);
    assert.equal(failed.run.queuedCount, 2);
    assert.equal(failed.run.processedCount, 1);
    assert.equal(failed.run.failedCount, 1);
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
  });
});
