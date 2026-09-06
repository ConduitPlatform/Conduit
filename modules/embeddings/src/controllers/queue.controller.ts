import { Queue, Worker } from 'bullmq';
import { Cluster, Redis } from 'ioredis';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  EmbeddingJobData,
  dedupeEmbeddingJobs,
  embeddingJobId,
  isDuplicateJobError,
} from '../utils/embeddingJobs.js';

export type { EmbeddingJobData } from '../utils/embeddingJobs.js';

type RedisConnection = Redis | Cluster;

type QueueLike = {
  add: (
    name: string,
    data: EmbeddingJobData,
    opts?: Record<string, unknown>,
  ) => Promise<unknown>;
  addBulk: (
    jobs: Array<{ name: string; data: EmbeddingJobData; opts?: Record<string, unknown> }>,
  ) => Promise<unknown>;
  close: () => Promise<unknown>;
};

type WorkerLike = {
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  close: () => Promise<unknown>;
};

export interface QueueControllerDependencies {
  createConnection?: () => RedisConnection;
  Queue?: new (name: string, opts: { connection: RedisConnection }) => QueueLike;
  Worker?: new (
    name: string,
    processor: (job: { data: EmbeddingJobData }) => Promise<void>,
    opts: { connection: RedisConnection; concurrency: number } & Record<string, unknown>,
  ) => WorkerLike;
}

export class QueueController {
  private static _instance: QueueController;
  private readonly createConnection: () => RedisConnection;
  private readonly QueueImpl: NonNullable<QueueControllerDependencies['Queue']>;
  private readonly WorkerImpl: NonNullable<QueueControllerDependencies['Worker']>;
  private readonly queueConnection: RedisConnection;
  private readonly embeddingQueue: QueueLike;
  private worker?: WorkerLike;
  private workerConnection?: RedisConnection;
  private workerConcurrency?: number;
  private closingWorker = false;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    deps: QueueControllerDependencies = {},
  ) {
    this.createConnection =
      deps.createConnection ?? (() => this.grpcSdk.redisManager.getClient());
    this.QueueImpl =
      deps.Queue ??
      (Queue as unknown as NonNullable<QueueControllerDependencies['Queue']>);
    this.WorkerImpl =
      deps.Worker ??
      (Worker as unknown as NonNullable<QueueControllerDependencies['Worker']>);
    this.queueConnection = this.createConnection();
    this.embeddingQueue = new this.QueueImpl('embeddings-generation-queue', {
      connection: this.queueConnection,
    });
  }

  static getInstance(grpcSdk?: ConduitGrpcSdk, deps?: QueueControllerDependencies) {
    if (QueueController._instance) return QueueController._instance;
    if (!grpcSdk) throw new Error('No grpcSdk instance provided!');
    return (QueueController._instance = new QueueController(grpcSdk, deps));
  }

  static resetInstance() {
    QueueController._instance = undefined as unknown as QueueController;
  }

  get hasWorker() {
    return this.worker !== undefined;
  }

  get currentConcurrency() {
    return this.workerConcurrency;
  }

  async ensureWorker(
    processor: (data: EmbeddingJobData) => Promise<void>,
    concurrency: number,
  ) {
    if (this.worker && this.workerConcurrency === concurrency) {
      return this.worker;
    }
    await this.closeWorker();
    this.workerConnection = this.createConnection();
    const worker = new this.WorkerImpl(
      'embeddings-generation-queue',
      job => processor(job.data),
      {
        concurrency,
        connection: this.workerConnection,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    );
    worker.on('failed', (_job, error) => ConduitGrpcSdk.Logger.error(error as Error));
    worker.on('error', error => ConduitGrpcSdk.Logger.error(error as Error));
    this.worker = worker;
    this.workerConcurrency = concurrency;
    return worker;
  }

  async closeWorker() {
    if (this.closingWorker || !this.worker) return;
    this.closingWorker = true;
    const worker = this.worker;
    const connection = this.workerConnection;
    this.worker = undefined;
    this.workerConnection = undefined;
    this.workerConcurrency = undefined;
    try {
      await worker.close();
      await connection?.quit();
    } finally {
      this.closingWorker = false;
    }
  }

  async close() {
    await this.closeWorker();
    await this.embeddingQueue.close();
    await this.queueConnection.quit();
  }

  async addEmbeddingJob(data: EmbeddingJobData, attempts: number) {
    try {
      await this.embeddingQueue.add(embeddingJobId(data), data, {
        jobId: embeddingJobId(data),
        attempts,
        backoff: { type: 'exponential', delay: 1000 },
      });
    } catch (err) {
      if (!isDuplicateJobError(err)) throw err;
    }
  }

  async addBulkEmbeddingJobs(data: EmbeddingJobData[], attempts: number) {
    const jobs = dedupeEmbeddingJobs(data);
    if (!jobs.length) return;
    try {
      await this.embeddingQueue.addBulk(
        jobs.map(job => ({
          name: embeddingJobId(job),
          data: job,
          opts: {
            jobId: embeddingJobId(job),
            attempts,
            backoff: { type: 'exponential', delay: 1000 },
          },
        })),
      );
    } catch (err) {
      if (!isDuplicateJobError(err)) throw err;
      await Promise.all(jobs.map(job => this.addEmbeddingJob(job, attempts)));
    }
  }
}
