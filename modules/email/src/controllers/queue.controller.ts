import path from 'path';
import { Queue, Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { Cluster, Redis } from 'ioredis';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class QueueController {
  private static _instance: QueueController;
  private readonly redisConnection: Redis | Cluster;
  private emailStatusQueue: Queue;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.redisConnection = this.grpcSdk.redisManager.getClient();
    this.emailStatusQueue = this.initializeEmailStatusQueue();
  }

  static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (QueueController._instance) {
      return QueueController._instance;
    }
    if (grpcSdk) {
      QueueController._instance = new QueueController(grpcSdk);
      return QueueController._instance;
    }
    throw new Error('No grpcSdk instance provided!');
  }

  initializeEmailStatusQueue() {
    return new Queue('email-status-queue', {
      connection: this.redisConnection,
    });
  }

  addEmailStatusWorker() {
    const worker = new Worker(
      'email-status-queue',
      path.normalize(path.join(__dirname, '../jobs', 'getEmailStatus.js')),
      {
        concurrency: 5,
        connection: this.redisConnection,
      },
    );

    worker.on('active', job => {
      ConduitGrpcSdk.Logger.info(`Job ${job.id} started`);
    });
    worker.on('completed', job => {
      ConduitGrpcSdk.Logger.info(`Job ${job.id} completed`);
    });
    worker.on('error', (error: Error) => {
      ConduitGrpcSdk.Logger.error(`Job error:`);
      ConduitGrpcSdk.Logger.error(error);
    });
    worker.on('failed', (job, error) => {
      ConduitGrpcSdk.Logger.error(`Job error:`);
      ConduitGrpcSdk.Logger.error(error);
    });
  }

  async addEmailStatusJob(messageId: string, emailRecId: string, retries = 0) {
    await this.emailStatusQueue.add(
      randomUUID(),
      {
        messageId,
        emailRecId,
        retries,
      },
      {
        delay: 5000 * (retries + 1),
      },
    );
  }
}
