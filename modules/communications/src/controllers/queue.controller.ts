import path from 'path';
import { Job, Queue, Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { Cluster, Redis } from 'ioredis';
import { fileURLToPath } from 'node:url';

export class QueueController {
  private static _instance: QueueController;
  private readonly redisConnection: Redis | Cluster;
  private emailStatusQueue: Queue;
  private emailCleanupQueue: Queue;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.redisConnection = this.grpcSdk.redisManager.getClient();
    this.initializeQueues();
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

  private initializeQueues(): void {
    this.emailStatusQueue = this.createQueue('email-status-queue');
    this.emailCleanupQueue = this.createQueue('email-cleanup-queue');
  }

  private createQueue(name: string): Queue {
    return new Queue(name, {
      connection: this.redisConnection,
    });
  }

  private addWorker(name: string, jobPath: string): Worker {
    const worker = new Worker(
      name,
      path.normalize(
        path.join(path.dirname(fileURLToPath(import.meta.url)), '../jobs', jobPath),
      ),
      {
        concurrency: 5,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
        connection: this.redisConnection,
      },
    );
    this.setupWorkerEventHandlers(worker);
    return worker;
  }

  addEmailStatusWorker(): Worker {
    return this.addWorker('email-status-queue', 'getEmailStatus.js');
  }

  addEmailCleanupWorker(): Worker {
    return this.addWorker('email-cleanup-queue', 'cleanupStoredEmails.js');
  }

  async drainEmailCleanupQueue(): Promise<void> {
    return this.emailCleanupQueue.drain();
  }

  private setupWorkerEventHandlers(worker: Worker): void {
    worker.on('active', (job: Job) => {
      ConduitGrpcSdk.Logger.info(`Job ${job.id} started`);
    });
    worker.on('completed', (job: Job) => {
      ConduitGrpcSdk.Logger.info(`Job ${job.id} completed`);
    });
    worker.on('error', (error: Error) => {
      ConduitGrpcSdk.Logger.error(`Job error:`);
      ConduitGrpcSdk.Logger.error(error);
    });
    worker.on('failed', (job: Job | undefined, error: Error) => {
      ConduitGrpcSdk.Logger.error(`Job failed:`);
      ConduitGrpcSdk.Logger.error(
        job ? `Job ID: ${job.id}, Error: ${error.message}` : `Error: ${error.message}`,
      );
    });
  }

  async addEmailStatusJob(
    messageId: string,
    emailRecId: string,
    retries = 0,
  ): Promise<Job> {
    return this.emailStatusQueue.add(
      `email-status-${randomUUID()}`,
      {
        messageId,
        emailRecId,
        retries,
      },
      { delay: 5000 * (retries + 1) },
    );
  }

  async addEmailCleanupJob(
    limit: number,
    deleteStorageFiles: boolean,
    repeat: number,
  ): Promise<Job> {
    return this.emailCleanupQueue.add(
      `email-cleanup-${randomUUID()}`,
      { limit, deleteStorageFiles },
      { repeat: { every: repeat } },
    );
  }
}
