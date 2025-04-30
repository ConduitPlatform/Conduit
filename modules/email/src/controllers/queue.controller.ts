import path from 'path';
import { Queue, Worker, Job, WorkerOptions } from 'bullmq';
import { randomUUID } from 'crypto';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { Cluster, Redis } from 'ioredis';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commonWorkerOptions: Partial<WorkerOptions> = {
  concurrency: 5,
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 24 * 3600 },
};

export class QueueController {
  private static _instance: QueueController;
  private readonly redisConnection: Redis | Cluster;
  private emailStatusQueue!: Queue;
  private emailCleanupQueue!: Queue;

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.redisConnection = this.grpcSdk.redisManager.getClient();
  }

  static async getInstance(grpcSdk?: ConduitGrpcSdk): Promise<QueueController> {
    if (QueueController._instance) {
      return QueueController._instance;
    }
    if (!grpcSdk) {
      throw new Error('No grpcSdk instance provided!');
    }
    const instance = new QueueController(grpcSdk);
    await instance.initializeQueues();
    QueueController._instance = instance;
    return QueueController._instance;
  }

  private async initializeQueues(): Promise<void> {
    this.emailStatusQueue = this.createQueue('email-status-queue');
    this.emailCleanupQueue = await this.createAndDrainQueue('email-cleanup-queue');
  }

  private createQueue(name: string): Queue {
    return new Queue(name, {
      connection: this.redisConnection,
    });
  }

  private async createAndDrainQueue(name: string): Promise<Queue> {
    const queue = this.createQueue(name);
    await queue.drain(true);
    return queue;
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

  addEmailStatusWorker(): Worker {
    const worker = new Worker(
      'email-status-queue',
      path.normalize(path.join(__dirname, '../jobs', 'getEmailStatus.js')),
      {
        ...commonWorkerOptions,
        connection: this.redisConnection,
      },
    );
    this.setupWorkerEventHandlers(worker);
    return worker;
  }

  addEmailCleanupWorker(): Worker {
    const worker = new Worker(
      'email-cleanup-queue',
      path.normalize(path.join(__dirname, '../jobs', 'cleanupStoredEmails.js')),
      {
        ...commonWorkerOptions,
        connection: this.redisConnection,
      },
    );
    this.setupWorkerEventHandlers(worker);
    return worker;
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
