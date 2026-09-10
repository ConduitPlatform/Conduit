import { Queue, Worker } from 'bullmq';
import { Cluster, Redis } from 'ioredis';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  EmbeddingJobData,
  dedupeEmbeddingJobs,
  embeddingJobId,
  isDuplicateJobError,
  isInFlightQueueJobState,
  parseEmbeddingJobData,
  shouldReplaceRetainedQueueJob,
} from '../utils/embeddingJobs.js';
import {
  BackfillControllerJobData,
  parseBackfillControllerJob,
  BACKFILL_DRAIN_DELAY_MS,
} from '../utils/backfillExecution.js';
import { incrementEmbeddingMetric } from '../utils/embeddingMetrics.js';
import { sanitizeErrorMessage } from '../utils/redactConfig.js';
import {
  parseStorageIngestJob,
  storageIngestJobId,
  type StorageIngestJobData,
} from '../utils/storageJobs.js';

export type { EmbeddingJobData } from '../utils/embeddingJobs.js';
export type { BackfillControllerJobData } from '../utils/backfillExecution.js';
export type { StorageIngestJobData } from '../utils/storageJobs.js';

type RedisConnection = Redis | Cluster;

export interface QueueJobCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface EmbeddingQueueStatus {
  generation: QueueJobCounts;
  backfill: QueueJobCounts;
  storage: QueueJobCounts;
}

type QueueJobHandle = {
  getState: () => Promise<string>;
  remove: () => Promise<unknown>;
};

type QueueLike = {
  add: (
    name: string,
    data: Record<string, unknown>,
    opts?: Record<string, unknown>,
  ) => Promise<unknown>;
  addBulk: (
    jobs: Array<{
      name: string;
      data: Record<string, unknown>;
      opts?: Record<string, unknown>;
    }>,
  ) => Promise<unknown>;
  close: () => Promise<unknown>;
  getJob?: (jobId: string) => Promise<QueueJobHandle | undefined | null>;
  getJobCounts: () => Promise<Partial<QueueJobCounts> & Record<string, number>>;
};

type WorkerJob = {
  data?: unknown;
  attemptsMade?: number;
  opts?: { attempts?: number };
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
    processor: (job: WorkerJob) => Promise<void>,
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
  private readonly backfillQueue: QueueLike;
  private worker?: WorkerLike;
  private workerConnection?: RedisConnection;
  private workerConcurrency?: number;
  private closingWorker = false;
  private backfillWorker?: WorkerLike;
  private backfillWorkerConnection?: RedisConnection;
  private backfillWorkerConcurrency?: number;
  private closingBackfillWorker = false;
  private readonly storageQueue: QueueLike;
  private storageWorker?: WorkerLike;
  private storageWorkerConnection?: RedisConnection;
  private storageWorkerConcurrency?: number;
  private closingStorageWorker = false;
  private onBackfillJobOutcome?: (
    runId: string,
    outcome: 'processed' | 'failed',
  ) => Promise<void>;

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
    this.backfillQueue = new this.QueueImpl('embeddings-backfill-queue', {
      connection: this.queueConnection,
    });
    this.storageQueue = new this.QueueImpl('embeddings-storage-queue', {
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

  get hasBackfillWorker() {
    return this.backfillWorker !== undefined;
  }

  get currentConcurrency() {
    return this.workerConcurrency;
  }

  get currentBackfillConcurrency() {
    return this.backfillWorkerConcurrency;
  }

  get hasStorageWorker() {
    return this.storageWorker !== undefined;
  }

  get currentStorageConcurrency() {
    return this.storageWorkerConcurrency;
  }

  setBackfillJobOutcomeHandler(
    handler?: (runId: string, outcome: 'processed' | 'failed') => Promise<void>,
  ) {
    this.onBackfillJobOutcome = handler;
  }

  async ensureWorker(
    processor: (data: EmbeddingJobData) => Promise<void>,
    concurrency: number,
  ) {
    if (this.worker && this.workerConcurrency === concurrency) {
      return this.worker;
    }
    await this.closeGenerationWorker();
    this.workerConnection = this.createConnection();
    const worker = new this.WorkerImpl(
      'embeddings-generation-queue',
      job => {
        const parsed = parseEmbeddingJobData(job.data);
        if (!parsed.ok) {
          incrementEmbeddingMetric('malformedJobs');
          return Promise.resolve();
        }
        return processor(parsed.data);
      },
      {
        concurrency,
        connection: this.workerConnection,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    );
    worker.on('failed', (job, error) =>
      this.handleGenerationFailure(job as WorkerJob | undefined, error),
    );
    worker.on('error', error => ConduitGrpcSdk.Logger.error(sanitizeErrorMessage(error)));
    this.worker = worker;
    this.workerConcurrency = concurrency;
    return worker;
  }

  async ensureBackfillWorker(
    processor: (data: BackfillControllerJobData) => Promise<void>,
    concurrency: number,
  ) {
    if (this.backfillWorker && this.backfillWorkerConcurrency === concurrency) {
      return this.backfillWorker;
    }
    await this.closeBackfillWorker();
    this.backfillWorkerConnection = this.createConnection();
    const worker = new this.WorkerImpl(
      'embeddings-backfill-queue',
      job => {
        const parsed = parseBackfillControllerJob(job.data);
        if (!parsed.ok) {
          incrementEmbeddingMetric('malformedJobs');
          return Promise.resolve();
        }
        return processor(parsed.data);
      },
      {
        concurrency,
        connection: this.backfillWorkerConnection,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    );
    worker.on('failed', (_job, error) =>
      ConduitGrpcSdk.Logger.error(sanitizeErrorMessage(error)),
    );
    worker.on('error', error => ConduitGrpcSdk.Logger.error(sanitizeErrorMessage(error)));
    this.backfillWorker = worker;
    this.backfillWorkerConcurrency = concurrency;
    return worker;
  }

  async ensureStorageWorker(
    processor: (data: StorageIngestJobData) => Promise<void>,
    concurrency: number,
  ) {
    if (this.storageWorker && this.storageWorkerConcurrency === concurrency) {
      return this.storageWorker;
    }
    await this.closeStorageWorker();
    this.storageWorkerConnection = this.createConnection();
    const worker = new this.WorkerImpl(
      'embeddings-storage-queue',
      job => {
        const parsed = parseStorageIngestJob(job.data);
        if (!parsed.ok) {
          incrementEmbeddingMetric('malformedJobs');
          return Promise.resolve();
        }
        return processor(parsed.data);
      },
      {
        concurrency,
        connection: this.storageWorkerConnection,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
      },
    );
    worker.on('failed', (job, error) =>
      this.handleStorageFailure(job as WorkerJob | undefined, error),
    );
    worker.on('error', error => ConduitGrpcSdk.Logger.error(sanitizeErrorMessage(error)));
    this.storageWorker = worker;
    this.storageWorkerConcurrency = concurrency;
    return worker;
  }

  async closeWorker() {
    await Promise.all([
      this.closeGenerationWorker(),
      this.closeBackfillWorker(),
      this.closeStorageWorker(),
    ]);
  }

  async close() {
    await this.closeWorker();
    await this.embeddingQueue.close();
    await this.backfillQueue.close();
    await this.storageQueue.close();
    await this.queueConnection.quit();
  }

  async getJobCounts(
    queue: 'generation' | 'backfill' | 'storage' = 'generation',
  ): Promise<QueueJobCounts> {
    const counts =
      queue === 'backfill'
        ? await this.backfillQueue.getJobCounts()
        : queue === 'storage'
          ? await this.storageQueue.getJobCounts()
          : await this.embeddingQueue.getJobCounts();
    return normalizeJobCounts(counts);
  }

  async getQueueStatus(): Promise<EmbeddingQueueStatus> {
    const [generation, backfill, storage] = await Promise.all([
      this.getJobCounts('generation'),
      this.getJobCounts('backfill'),
      this.getJobCounts('storage'),
    ]);
    return { generation, backfill, storage };
  }

  async addEmbeddingJob(data: EmbeddingJobData, attempts: number) {
    const parsed = parseEmbeddingJobData(data);
    if (!parsed.ok) {
      incrementEmbeddingMetric('malformedJobs');
      return 0;
    }
    const jobId = embeddingJobId(parsed.data);
    const decision = await resolveExistingQueueJob(this.embeddingQueue, jobId);
    if (decision === 'skip') return 0;
    try {
      await this.embeddingQueue.add(
        jobId,
        { ...parsed.data },
        {
          jobId,
          attempts,
          backoff: { type: 'exponential', delay: 1000 },
        },
      );
      return 1;
    } catch (err) {
      if (!isDuplicateJobError(err)) throw err;
      return 0;
    }
  }

  async addBulkEmbeddingJobs(data: EmbeddingJobData[], attempts: number) {
    const jobs: EmbeddingJobData[] = [];
    for (const [index, item] of data.entries()) {
      const parsed = parseEmbeddingJobData(item, index);
      if (!parsed.ok) {
        incrementEmbeddingMetric('malformedJobs');
        continue;
      }
      jobs.push(parsed.data);
    }
    const unique = dedupeEmbeddingJobs(jobs);
    if (!unique.length) return 0;
    const enqueueable: EmbeddingJobData[] = [];
    for (const job of unique) {
      const decision = await resolveExistingQueueJob(
        this.embeddingQueue,
        embeddingJobId(job),
      );
      if (decision === 'skip') continue;
      enqueueable.push(job);
    }
    if (!enqueueable.length) return 0;
    try {
      await this.embeddingQueue.addBulk(
        enqueueable.map(job => ({
          name: embeddingJobId(job),
          data: { ...job },
          opts: {
            jobId: embeddingJobId(job),
            attempts,
            backoff: { type: 'exponential', delay: 1000 },
          },
        })),
      );
      return enqueueable.length;
    } catch (err) {
      if (!isDuplicateJobError(err)) throw err;
      const added = await Promise.all(
        enqueueable.map(job => this.addEmbeddingJob(job, attempts)),
      );
      let queued = 0;
      for (const count of added) queued += count;
      return queued;
    }
  }

  async addBackfillControllerJob(
    data: BackfillControllerJobData,
    opts?: { delay?: number },
  ) {
    const parsed = parseBackfillControllerJob(data);
    if (!parsed.ok) {
      incrementEmbeddingMetric('malformedJobs');
      return;
    }
    const delay =
      parsed.data.drain === true ? (opts?.delay ?? BACKFILL_DRAIN_DELAY_MS) : opts?.delay;
    const jobId = parsed.data.drain
      ? undefined
      : `backfill:${parsed.data.runId}:${parsed.data.cursor ?? 'start'}`;
    if (jobId) {
      const decision = await resolveExistingQueueJob(this.backfillQueue, jobId);
      if (decision === 'skip') return;
    }
    try {
      await this.backfillQueue.add(
        'backfill-page',
        { ...parsed.data },
        {
          ...(jobId ? { jobId } : {}),
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          ...(delay ? { delay } : {}),
        },
      );
    } catch (err) {
      if (!isDuplicateJobError(err)) throw err;
    }
  }

  async addStorageJobs(data: StorageIngestJobData[], attempts: number) {
    const unique: StorageIngestJobData[] = [];
    const seen = new Set<string>();
    for (const item of data) {
      const parsed = parseStorageIngestJob(item);
      if (!parsed.ok) {
        incrementEmbeddingMetric('malformedJobs');
        continue;
      }
      const jobId = storageIngestJobId(parsed.data);
      if (seen.has(jobId)) continue;
      seen.add(jobId);
      unique.push(parsed.data);
    }
    if (!unique.length) return 0;
    const enqueueable: StorageIngestJobData[] = [];
    for (const job of unique) {
      const decision = await resolveExistingQueueJob(
        this.storageQueue,
        storageIngestJobId(job),
      );
      if (decision === 'skip') continue;
      enqueueable.push(job);
    }
    if (!enqueueable.length) return 0;
    try {
      await this.storageQueue.addBulk(
        enqueueable.map(job => ({
          name: storageIngestJobId(job),
          data: { ...job },
          opts: {
            jobId: storageIngestJobId(job),
            attempts,
            backoff: { type: 'exponential', delay: 1000 },
          },
        })),
      );
      return enqueueable.length;
    } catch (err) {
      if (!isDuplicateJobError(err)) throw err;
      return 0;
    }
  }

  private async closeGenerationWorker() {
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

  private async closeBackfillWorker() {
    if (this.closingBackfillWorker || !this.backfillWorker) return;
    this.closingBackfillWorker = true;
    const worker = this.backfillWorker;
    const connection = this.backfillWorkerConnection;
    this.backfillWorker = undefined;
    this.backfillWorkerConnection = undefined;
    this.backfillWorkerConcurrency = undefined;
    try {
      await worker.close();
      await connection?.quit();
    } finally {
      this.closingBackfillWorker = false;
    }
  }

  private async closeStorageWorker() {
    if (this.closingStorageWorker || !this.storageWorker) return;
    this.closingStorageWorker = true;
    const worker = this.storageWorker;
    const connection = this.storageWorkerConnection;
    this.storageWorker = undefined;
    this.storageWorkerConnection = undefined;
    this.storageWorkerConcurrency = undefined;
    try {
      await worker.close();
      await connection?.quit();
    } finally {
      this.closingStorageWorker = false;
    }
  }

  private handleStorageFailure(job: WorkerJob | undefined, error: unknown) {
    ConduitGrpcSdk.Logger.error(sanitizeErrorMessage(error));
    const attempts = job?.opts?.attempts ?? 1;
    const made = job?.attemptsMade ?? 1;
    if (made < attempts) {
      incrementEmbeddingMetric('retried');
      return;
    }
    incrementEmbeddingMetric('failed');
  }

  private handleGenerationFailure(job: WorkerJob | undefined, error: unknown) {
    ConduitGrpcSdk.Logger.error(sanitizeErrorMessage(error));
    const attempts = job?.opts?.attempts ?? 1;
    const made = job?.attemptsMade ?? 1;
    if (made < attempts) {
      incrementEmbeddingMetric('retried');
      return;
    }
    incrementEmbeddingMetric('failed');
    const parsed = parseEmbeddingJobData(job?.data);
    if (!parsed.ok || !parsed.data.backfillRunId || !this.onBackfillJobOutcome) return;
    this.onBackfillJobOutcome(parsed.data.backfillRunId, 'failed').catch(err =>
      ConduitGrpcSdk.Logger.error(sanitizeErrorMessage(err)),
    );
  }
}

function normalizeJobCounts(
  counts: Partial<QueueJobCounts> & Record<string, number>,
): QueueJobCounts {
  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0,
    paused: counts.paused ?? 0,
  };
}

async function resolveExistingQueueJob(
  queue: QueueLike,
  jobId: string,
): Promise<'enqueue' | 'skip'> {
  if (!queue.getJob) return 'enqueue';
  const existing = await queue.getJob(jobId);
  if (!existing) return 'enqueue';
  const state = await existing.getState();
  if (isInFlightQueueJobState(state)) return 'skip';
  if (!shouldReplaceRetainedQueueJob(state)) return 'skip';
  try {
    await existing.remove();
  } catch {
    return 'skip';
  }
  return 'enqueue';
}
