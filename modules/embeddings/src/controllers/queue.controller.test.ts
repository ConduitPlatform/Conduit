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
};

class FakeQueue {
  jobs: StoredJob[] = [];
  closed = false;

  async add(name: string, data: Record<string, unknown>, opts?: StoredJob['opts']) {
    if (opts?.jobId && this.jobs.some(job => job.opts?.jobId === opts.jobId)) {
      throw new Error(`Job ${opts.jobId} already exists`);
    }
    this.jobs.push({ name, data, opts });
  }

  async addBulk(jobs: StoredJob[]) {
    for (const job of jobs) {
      await this.add(job.name, job.data, job.opts);
    }
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
) {
  return {
    queue,
    backfillQueue,
    controller: new QueueController(fakeSdk(), {
      Queue: class {
        constructor(name: string) {
          return name.includes('backfill') ? backfillQueue : queue;
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
    assert.equal((await controller.getJobCounts('generation')).waiting, 1);
    assert.equal((await controller.getJobCounts('backfill')).waiting, 1);
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
});
