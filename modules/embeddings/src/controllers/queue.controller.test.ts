import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { QueueController } from './queue.controller.js';
import { embeddingJobId } from '../utils/embeddingJobs.js';
import { EMBEDDING_METRICS } from '../utils/embeddingMetrics.js';

type StoredJob = {
  name: string;
  data: Record<string, unknown>;
  opts?: { jobId?: string; delay?: number; attempts?: number };
  state?: string;
};

class FakeQueue {
  jobs: StoredJob[] = [];
  closed = false;

  async add(name: string, data: Record<string, unknown>, opts?: StoredJob['opts']) {
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
    const job = this.jobs.find(stored => stored.opts?.jobId === jobId);
    if (!job) return undefined;
    return {
      getState: async () => job.state ?? 'waiting',
      remove: async () => {
        this.jobs = this.jobs.filter(stored => stored !== job);
      },
    };
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
    assert.equal(storageQueue.jobs[0]?.opts?.jobId, 'storage-ingest:src1:file1:v1');
    assert.equal(storageQueue.jobs[0]?.opts?.attempts, 5);
  });

  it('enqueues lightweight backfill controller jobs with cursor identity', async () => {
    const { backfillQueue, controller } = createController();
    await controller.addBackfillControllerJob({ runId: 'run1', cursor: null });
    await controller.addBackfillControllerJob({ runId: 'run1', cursor: null });
    await controller.addBackfillControllerJob({ runId: 'run1', cursor: 'b' });
    await controller.addBackfillControllerJob({ runId: 'run1', drain: true });
    assert.deepEqual(
      backfillQueue.jobs.map(job => job.opts?.jobId),
      ['backfill:run1:start', 'backfill:run1:b', undefined],
    );
    assert.equal(
      backfillQueue.jobs.some(job => job.opts?.delay === 1000),
      true,
    );
  });

  it('does not let a completed backfill page job block a later scan of the same cursor', async () => {
    const { backfillQueue, controller } = createController();
    await controller.addBackfillControllerJob({ runId: 'run1', cursor: 'b' });
    backfillQueue.markState('backfill:run1:b', 'completed');
    await controller.addBackfillControllerJob({ runId: 'run1', cursor: 'b' });
    assert.deepEqual(
      backfillQueue.jobs.map(job => job.opts?.jobId),
      ['backfill:run1:b'],
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
});
