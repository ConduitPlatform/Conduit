import { Job, Queue, Worker } from 'bullmq';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { Cluster, Redis } from 'ioredis';

export class QueueController {
  private static _instance: QueueController;
  private readonly redisConnection: Redis | Cluster;
  private viewCleanupQueue: Queue;
  private viewCleanupWorker?: Worker;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.redisConnection = this.grpcSdk.redisManager.getClient();
    this.viewCleanupQueue = this.createQueue('view-cleanup-queue');
  }

  static getInstance(grpcSdk?: ConduitGrpcSdk): QueueController {
    if (QueueController._instance) {
      return QueueController._instance;
    }
    if (!grpcSdk) {
      throw new Error('No grpcSdk instance provided!');
    }
    QueueController._instance = new QueueController(grpcSdk);
    return QueueController._instance;
  }

  private createQueue(name: string): Queue {
    return new Queue(name, {
      connection: this.redisConnection,
    });
  }

  addViewCleanupWorker(
    processor: (
      job: Job<{ stalenessThresholdMs: number; batchSize: number }>,
    ) => Promise<void>,
  ): Worker {
    if (this.viewCleanupWorker) {
      return this.viewCleanupWorker;
    }
    this.viewCleanupWorker = new Worker('view-cleanup-queue', processor, {
      concurrency: 1,
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
      connection: this.redisConnection,
    });
    this.setupWorkerEventHandlers(this.viewCleanupWorker);
    return this.viewCleanupWorker;
  }

  async drainViewCleanupQueue(): Promise<void> {
    if (this.viewCleanupWorker) {
      await this.viewCleanupWorker.close();
      this.viewCleanupWorker = undefined;
    }
    await this.viewCleanupQueue.drain();
    const repeatables = await this.viewCleanupQueue.getRepeatableJobs();
    for (const job of repeatables) {
      await this.viewCleanupQueue.removeRepeatableByKey(job.key);
    }
  }

  private setupWorkerEventHandlers(worker: Worker): void {
    worker.on('active', (job: Job) => {
      ConduitGrpcSdk.Logger.info(`View cleanup job ${job.id} started`);
    });
    worker.on('completed', (job: Job) => {
      ConduitGrpcSdk.Logger.info(`View cleanup job ${job.id} completed`);
    });
    worker.on('error', (error: Error) => {
      ConduitGrpcSdk.Logger.error(`View cleanup worker error:`);
      ConduitGrpcSdk.Logger.error(error);
    });
    worker.on('failed', (job: Job | undefined, error: Error) => {
      ConduitGrpcSdk.Logger.error(
        job
          ? `View cleanup job failed: ${job.id}, ${error.message}`
          : `View cleanup job error: ${error.message}`,
      );
    });
  }

  async addViewCleanupJob(
    stalenessThresholdMs: number,
    batchSize: number,
    repeatOptions: { pattern: string },
  ): Promise<Job> {
    return this.viewCleanupQueue.add(
      'view-cleanup',
      { stalenessThresholdMs, batchSize },
      { repeat: repeatOptions },
    );
  }
}
