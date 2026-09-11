import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { QueueController } from './queue.controller.js';
import { backfillControllerJobId } from '../utils/backfillExecution.js';
import { embeddingJobId } from '../utils/embeddingJobs.js';
import { EMBEDDING_METRICS } from '../utils/embeddingMetrics.js';
import { storageIngestJobId } from '../utils/storageJobs.js';

type StoredJob = {
  name: string;
  data: Record<string, unknown>;
  opts?: { jobId?: string; delay?: number; attempts?: number };
  state?: string;
};

class FakeQueue {
  jobs: StoredJob[] = [];
  closed = false;
  missOnce = new Set<string>();

  async add(name: string, data: Record<string, unknown>, opts?: StoredJob['opts']) {
    if (opts?.jobId) {
      if (`${Number.parseInt(opts.jobId, 10)}` === opts.jobId) {
        throw new Error('Custom Id cannot be integers');
      }
      if (opts.jobId.includes(':')) {
        throw new Error('Custom Id cannot contain :');
      }
    }
    if (opts?.jobId && this.jobs.some(job => job.opts?.jobId === opts.jobId)) {
      throw new Error(`Job ${opts.jobId} already exists`);
    }
    this.jobs.push({ name, data, opts, state: 'waiting' });
  }

  async addBulk(jobs: StoredJob[]) {
    for (const job of jobs) {
      await this.add(job.name, job.data, job.opts);
    }
  }

  async getJob(jobId: string) {
    if (this.missOnce.has(jobId)) {
      this.missOnce.delete(jobId);
      return undefined;
    }
    const job = this.jobs.find(stored => stored.opts?.jobId === jobId);
    if (!job) return undefined;
    return {
      data: job.data,
      getState: async () => job.state ?? 'waiting',
      remove: async () => {
        this.jobs = this.jobs.filter(stored => stored !== job);
      },
    };
  }

  async getJobs(types: string[]) {
    return this.jobs
      .filter(job => types.includes(job.state ?? 'waiting'))
      .map(job => ({
        data: job.data,
        getState: async () => job.state ?? 'waiting',
        remove: async () => {
          this.jobs = this.jobs.filter(stored => stored !== job);
        },
      }));
  }

  markState(jobId: string, state: string) {
    const job = this.jobs.find(stored => stored.opts?.jobId === jobId);
    if (job) job.state = state;
  }

  async getJobCounts() {
    return {
      waiting: this.jobs.length,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: this.jobs.filter(job => (job.opts?.delay ?? 0) > 0).length,
      paused: 0,
    };
  }

  async close() {
    this.closed = true;
  }
}

class FakeWorker {
  static instances: FakeWorker[] = [];
  closed = false;
  concurrency: number;
  name: string;
  handlers: Record<string, (...args: unknown[]) => void> = {};

  constructor(
    name: string,
    _processor: (job: { data: unknown }) => Promise<void>,
    opts: { concurrency: number },
  ) {
    this.name = name;
    this.concurrency = opts.concurrency;
    FakeWorker.instances.push(this);
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    this.handlers[event] = handler;
    return this;
  }

  async close() {
    this.closed = true;
  }
}

function createController(
  queue: FakeQueue = new FakeQueue(),
  backfillQueue: FakeQueue = new FakeQueue(),
  storageQueue: FakeQueue = new FakeQueue(),
) {
  return {
    queue,
    backfillQueue,
    storageQueue,
    controller: new QueueController(fakeSdk(), {
      Queue: class {
        constructor(name: string) {
          if (name.includes('storage')) return storageQueue;
          if (name.includes('backfill')) return backfillQueue;
          return queue;
        }
      } as never,
      Worker: FakeWorker as never,
    }),
  };
}

function fakeSdk() {
  return {
    redisManager: {
      getClient: () => ({ quit: async () => 'OK' }),
    },
  } as unknown as ConduitGrpcSdk;
}

function withMetrics() {
  const seen: Array<{ name: string; amount?: number; labels?: unknown }> = [];
  const previous = ConduitGrpcSdk.Metrics;
  ConduitGrpcSdk.Metrics = {
    increment(name: string, amount?: number, labels?: unknown) {
      seen.push({ name, amount, labels });
    },
  } as never;
  return {
    seen,
    restore() {
      ConduitGrpcSdk.Metrics = previous;
    },
  };
}

describe('embedding queue worker lifecycle', () => {
  it('keeps a single worker, recreates on concurrency change, and closes idempotently', async () => {
    FakeWorker.instances = [];
    const { controller } = createController();

    await controller.ensureWorker(async () => undefined, 2);
    await controller.ensureWorker(async () => undefined, 2);
    assert.equal(FakeWorker.instances.length, 1);
    assert.equal(controller.hasWorker, true);
    assert.equal(controller.currentConcurrency, 2);

    await controller.ensureWorker(async () => undefined, 4);
    assert.equal(FakeWorker.instances.length, 2);
    assert.equal(FakeWorker.instances[0].closed, true);
    assert.equal(FakeWorker.instances[1].closed, false);
    assert.equal(controller.currentConcurrency, 4);

    await controller.closeWorker();
    await controller.closeWorker();
    assert.equal(FakeWorker.instances[1].closed, true);
    assert.equal(controller.hasWorker, false);
  });

  it('does not recreate the backfill worker when generation concurrency changes', async () => {
    FakeWorker.instances = [];
    const { controller } = createController();
    await controller.ensureWorker(async () => undefined, 2);
    await controller.ensureBackfillWorker(async () => undefined, 1);
    assert.equal(controller.hasBackfillWorker, true);
    await controller.ensureWorker(async () => undefined, 3);
    const backfill = FakeWorker.instances.find(
      worker => worker.name === 'embeddings-backfill-queue',
    );
    assert.equal(backfill?.closed, false);
    assert.equal(controller.hasBackfillWorker, true);
  });

  it('deduplicates queued jobs by identity', async () => {
    FakeWorker.instances = [];
    const { queue, controller } = createController();
    const job = { schemaName: 'Article', documentId: 'a' };
    await controller.addEmbeddingJob(job, 3);
    await controller.addEmbeddingJob(job, 3);
    await controller.addBulkEmbeddingJobs(
      [job, { schemaName: 'Article', documentId: 'b' }, job],
      3,
    );
    assert.deepEqual(
      queue.jobs.map(stored => stored.opts?.jobId),
      [embeddingJobId(job), embeddingJobId({ schemaName: 'Article', documentId: 'b' })],
    );
  });

  it('re-enqueues the same identity after a retained completed or failed job', async () => {
    FakeWorker.instances = [];
    const { queue, controller } = createController();
    const job = { schemaName: 'Article', documentId: 'a' };
    assert.equal(await controller.addEmbeddingJob(job, 3), 1);
    queue.markState(embeddingJobId(job), 'completed');
    assert.equal(await controller.addEmbeddingJob(job, 3), 1);
    assert.equal(queue.jobs.length, 1);
    assert.equal(queue.jobs[0].state, 'waiting');
    queue.markState(embeddingJobId(job), 'failed');
    assert.equal(
      await controller.addBulkEmbeddingJobs(
        [job, { schemaName: 'Article', documentId: 'b' }],
        3,
      ),
      2,
    );
    assert.deepEqual(
      queue.jobs.map(stored => stored.opts?.jobId),
      [embeddingJobId(job), embeddingJobId({ schemaName: 'Article', documentId: 'b' })],
    );
  });

  it('skips malformed queue payloads instead of throwing', async () => {
    FakeWorker.instances = [];
    const { queue, controller } = createController();
    await controller.addEmbeddingJob(
      { schemaName: '../nope', documentId: 'a' } as never,
      3,
    );
    await controller.addBulkEmbeddingJobs(
      [
        { schemaName: 'Article', documentId: 'ok' },
        { schemaName: 'Article', documentId: '' } as never,
      ],
      3,
    );
    assert.deepEqual(
      queue.jobs.map(stored => stored.opts?.jobId),
      [embeddingJobId({ schemaName: 'Article', documentId: 'ok' })],
    );
  });
});

describe('embedding queue status and backfill jobs', () => {
  it('reports generation and backfill counts separately', async () => {
    const { controller, queue, backfillQueue } = createController();
    await controller.addEmbeddingJob({ schemaName: 'Article', documentId: 'a' }, 3);
    await controller.addBackfillControllerJob({ runId: 'run1', cursor: null });
    const status = await controller.getQueueStatus();
    assert.equal(status.generation.waiting, queue.jobs.length);
    assert.equal(status.backfill.waiting, backfillQueue.jobs.length);
    assert.equal(status.storage.waiting, 0);
    assert.equal((await controller.getJobCounts('generation')).waiting, 1);
    assert.equal((await controller.getJobCounts('backfill')).waiting, 1);
    assert.equal((await controller.getJobCounts('storage')).waiting, 0);
  });

  it('enqueues collision-safe storage jobs separately from generation', async () => {
    const { controller, queue, storageQueue } = createController();
    const queued = await controller.addStorageJobs(
      [
        {
          kind: 'ingest',
          sourceId: 'src1',
          fileId: 'file1',
          contentVersion: 'v1',
          reason: 'ready',
        },
        {
          kind: 'ingest',
          sourceId: 'src1',
          fileId: 'file1',
          contentVersion: 'v1',
          reason: 'ready',
        },
      ],
      5,
    );
    assert.equal(queued, 1);
    assert.equal(queue.jobs.length, 0);
    assert.equal(
      storageQueue.jobs[0]?.opts?.jobId,
      storageIngestJobId({
        kind: 'ingest',
        sourceId: 'src1',
        fileId: 'file1',
        contentVersion: 'v1',
      }),
    );
    assert.equal(storageQueue.jobs[0]?.opts?.attempts, 5);
  });

  it('enqueues remaining storage jobs when a mixed bulk hits a duplicate', async () => {
    const { controller, storageQueue } = createController();
    const duplicate = {
      kind: 'ingest' as const,
      sourceId: 'src1',
      fileId: 'file1',
      contentVersion: 'v2',
      reason: 'update' as const,
    };
    const leftover = {
      kind: 'ingest' as const,
      sourceId: 'src1',
      fileId: 'file2',
      contentVersion: 'v1',
      reason: 'ready' as const,
    };
    const otherSource = {
      kind: 'delete' as const,
      sourceId: 'src2',
      fileId: 'file1',
    };
    const duplicateId = storageIngestJobId(duplicate);
    await storageQueue.add(duplicateId, duplicate, { jobId: duplicateId });
    storageQueue.missOnce.add(duplicateId);
    const queued = await controller.addStorageJobs([duplicate, leftover, otherSource], 3);
    assert.equal(queued, 2);
    assert.equal(
      storageQueue.jobs.some(job => job.opts?.jobId === storageIngestJobId(leftover)),
      true,
    );
    assert.equal(
      storageQueue.jobs.some(job => job.opts?.jobId === storageIngestJobId(otherSource)),
      true,
    );
    const removed = await controller.cancelStorageJobsForSource('src1');
    assert.equal(removed >= 1, true);
    assert.equal(
      storageQueue.jobs.every(job => job.data.sourceId !== 'src1'),
      true,
    );
    assert.equal(
      storageQueue.jobs.some(job => job.data.sourceId === 'src2'),
      true,
    );
  });

  it('enqueues lightweight backfill controller jobs with cursor identity', async () => {
    const { backfillQueue, controller } = createController();
    await controller.addBackfillControllerJob({ runId: 'run1', cursor: null });
    await controller.addBackfillControllerJob({ runId: 'run1', cursor: null });
    await controller.addBackfillControllerJob({ runId: 'run1', cursor: 'b' });
    await controller.addBackfillControllerJob({ runId: 'run1', drain: true });
    assert.deepEqual(
      backfillQueue.jobs.map(job => job.opts?.jobId),
      [
        backfillControllerJobId({ runId: 'run1', cursor: null }),
        backfillControllerJobId({ runId: 'run1', cursor: 'b' }),
        undefined,
      ],
    );
    assert.equal(
      backfillQueue.jobs.some(job => job.opts?.delay === 1000),
      true,
    );
  });

  it('does not let a completed backfill page job block a later scan of the same cursor', async () => {
    const { backfillQueue, controller } = createController();
    await controller.addBackfillControllerJob({ runId: 'run1', cursor: 'b' });
    const pageId = backfillControllerJobId({ runId: 'run1', cursor: 'b' });
    backfillQueue.markState(pageId, 'completed');
    await controller.addBackfillControllerJob({ runId: 'run1', cursor: 'b' });
    assert.deepEqual(
      backfillQueue.jobs.map(job => job.opts?.jobId),
      [pageId],
    );
    assert.equal(backfillQueue.jobs[0].state, 'waiting');
  });

  it('increments retried then failed metrics without job payload labels', async () => {
    FakeWorker.instances = [];
    const metrics = withMetrics();
    try {
      const { controller } = createController();
      await controller.ensureWorker(async () => undefined, 1);
      const worker = FakeWorker.instances[0];
      const job = {
        data: { schemaName: 'Article', documentId: 'a', backfillRunId: 'run1' },
        attemptsMade: 1,
        opts: { attempts: 3 },
      };
      worker.handlers.failed?.(job, new Error('provider timeout apiKey=sk-secret'));
      job.attemptsMade = 3;
      worker.handlers.failed?.(job, new Error('provider timeout'));
      assert.deepEqual(
        metrics.seen.map(item => item.name),
        [EMBEDDING_METRICS.retried, EMBEDDING_METRICS.failed],
      );
      assert.equal(
        metrics.seen.every(item => item.labels === undefined),
        true,
      );
    } finally {
      metrics.restore();
    }
  });

  it('increments storage extraction failed metrics without job payload labels', async () => {
    FakeWorker.instances = [];
    const metrics = withMetrics();
    try {
      const { controller } = createController();
      await controller.ensureStorageWorker(async () => undefined, 1);
      const worker = FakeWorker.instances[0];
      const job = {
        data: {
          kind: 'ingest',
          sourceId: 'src1',
          fileId: 'file-secret',
          reason: 'ready',
        },
        attemptsMade: 5,
        opts: { attempts: 5 },
      };
      worker.handlers.failed?.(
        job,
        new Error('extract timeout storageFileId=file-secret'),
      );
      assert.deepEqual(
        metrics.seen.map(item => item.name),
        [EMBEDDING_METRICS.failed, EMBEDDING_METRICS.storageFailed],
      );
      assert.equal(
        metrics.seen.every(item => item.labels === undefined),
        true,
      );
      assert.equal(JSON.stringify(metrics.seen).includes('file-secret'), false);
    } finally {
      metrics.restore();
    }
  });

  it('remediates only failed jobs for one source and leaves current unresolved failures', async () => {
    const metrics = withMetrics();
    try {
      const { controller, storageQueue } = createController();
      const planned = {
        kind: 'ingest' as const,
        sourceId: 'src-a',
        fileId: 'file-1',
        contentVersion: 'v2',
        reason: 'reconcile' as const,
      };
      const stale = {
        kind: 'ingest' as const,
        sourceId: 'src-a',
        fileId: 'file-1',
        contentVersion: 'v1',
        reason: 'ready' as const,
      };
      const currentFailed = {
        kind: 'ingest' as const,
        sourceId: 'src-a',
        fileId: 'file-1',
        contentVersion: 'v2',
        reason: 'update' as const,
      };
      const unresolved = {
        kind: 'ingest' as const,
        sourceId: 'src-a',
        fileId: 'file-2',
        contentVersion: 'v9',
        reason: 'ready' as const,
      };
      const otherSource = {
        kind: 'ingest' as const,
        sourceId: 'src-b',
        fileId: 'file-1',
        contentVersion: 'v1',
        reason: 'ready' as const,
      };
      const completedSameFile = {
        kind: 'ingest' as const,
        sourceId: 'src-a',
        fileId: 'file-1',
        contentVersion: 'v0',
        reason: 'ready' as const,
      };
      for (const job of [
        stale,
        currentFailed,
        unresolved,
        otherSource,
        completedSameFile,
      ]) {
        const jobId = storageIngestJobId(job);
        await storageQueue.add(jobId, job, { jobId });
      }
      storageQueue.markState(storageIngestJobId(stale), 'failed');
      storageQueue.markState(storageIngestJobId(currentFailed), 'failed');
      storageQueue.markState(storageIngestJobId(unresolved), 'failed');
      storageQueue.markState(storageIngestJobId(otherSource), 'failed');
      storageQueue.markState(storageIngestJobId(completedSameFile), 'completed');

      const remediations = await controller.recoverStorageJobsForReconcile('src-a', [
        planned,
      ]);
      assert.equal(remediations.recovered, 1);
      assert.equal(remediations.discarded, 1);
      assert.equal(
        storageQueue.jobs.some(job => job.opts?.jobId === storageIngestJobId(stale)),
        false,
      );
      assert.equal(
        storageQueue.jobs.some(
          job => job.opts?.jobId === storageIngestJobId(currentFailed),
        ),
        false,
      );
      assert.equal(
        storageQueue.jobs.some(job => job.opts?.jobId === storageIngestJobId(unresolved)),
        true,
      );
      assert.equal(
        storageQueue.jobs.some(
          job => job.opts?.jobId === storageIngestJobId(otherSource),
        ),
        true,
      );
      assert.equal(
        storageQueue.jobs.some(
          job => job.opts?.jobId === storageIngestJobId(completedSameFile),
        ),
        true,
      );

      assert.equal(await controller.addStorageJobs([planned], 3), 1);
      const sourceA = await controller.getStorageQueueCounts('src-a');
      const sourceB = await controller.getStorageQueueCounts('src-b');
      assert.equal(sourceA.failed, 1);
      assert.equal(sourceA.waiting, 1);
      assert.equal(sourceA.completed, 1);
      assert.equal(sourceB.failed, 1);
      assert.equal(sourceB.waiting, 0);

      assert.equal(await controller.clearObsoleteStorageFailures('src-a', 'file-1'), 0);
      assert.equal((await controller.getStorageQueueCounts('src-a')).failed, 1);
      assert.equal((await controller.getStorageQueueCounts('src-b')).failed, 1);
      assert.equal(
        metrics.seen.some(item => item.name === EMBEDDING_METRICS.storageRecovered),
        true,
      );
      assert.equal(
        metrics.seen.some(item => item.name === EMBEDDING_METRICS.storageDiscarded),
        true,
      );
      assert.equal(JSON.stringify(metrics.seen).includes('file-1'), false);
      assert.equal(JSON.stringify(metrics.seen).includes('src-a'), false);
    } finally {
      metrics.restore();
    }
  });
});
