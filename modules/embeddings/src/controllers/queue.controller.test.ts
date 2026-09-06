import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { QueueController } from './queue.controller.js';
import { EmbeddingJobData, embeddingJobId } from '../utils/embeddingJobs.js';

type StoredJob = {
  name: string;
  data: EmbeddingJobData;
  opts?: { jobId?: string };
};

class FakeQueue {
  jobs: StoredJob[] = [];
  closed = false;

  async add(name: string, data: EmbeddingJobData, opts?: { jobId?: string }) {
    if (this.jobs.some(job => job.opts?.jobId === opts?.jobId)) {
      throw new Error(`Job ${opts?.jobId} already exists`);
    }
    this.jobs.push({ name, data, opts });
  }

  async addBulk(jobs: StoredJob[]) {
    for (const job of jobs) {
      await this.add(job.name, job.data, job.opts);
    }
  }

  async close() {
    this.closed = true;
  }
}

class FakeWorker {
  static instances: FakeWorker[] = [];
  closed = false;
  concurrency: number;

  constructor(
    _name: string,
    _processor: (job: { data: EmbeddingJobData }) => Promise<void>,
    opts: { concurrency: number },
  ) {
    this.concurrency = opts.concurrency;
    FakeWorker.instances.push(this);
  }

  on() {
    return this;
  }

  async close() {
    this.closed = true;
  }
}

function createController(queue: FakeQueue = new FakeQueue()) {
  return {
    queue,
    controller: new QueueController(fakeSdk(), {
      Queue: class {
        constructor() {
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
