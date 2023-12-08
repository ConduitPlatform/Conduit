import path from 'path';
import { Queue, Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, { GrpcError } from '@conduitplatform/grpc-sdk';
import { Redis, Cluster } from 'ioredis';

export class QueueController {
  private static _instance: QueueController;
  private readonly redisConnection: Redis | Cluster;
  private authorizationQueue: Queue;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.redisConnection = this.grpcSdk.redisManager.getClient();
    this.authorizationQueue = this.initializeRelationIndexQueue();
  }

  static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (QueueController._instance) return QueueController._instance;
    if (grpcSdk) {
      return (QueueController._instance = new QueueController(grpcSdk));
    }
    throw new Error('No grpcSdk instance provided!');
  }

  initializeRelationIndexQueue() {
    return new Queue('authorization-index-queue', {
      connection: this.redisConnection,
    });
  }

  addRelationIndexWorker() {
    const processorFile = path.normalize(
      path.join(__dirname, '../jobs', 'constructRelationIndex.js'),
    );
    const worker = new Worker('authorization-index-queue', processorFile, {
      connection: this.redisConnection,
      // autorun: true,
    });
    worker.on('completed', (job: any) => {
      ConduitGrpcSdk.Logger.info(`Job ${job.id} completed`);
    });
    worker.on('error', (error: any) => {
      ConduitGrpcSdk.Logger.info(`Job error:`, error);
    });
  }

  async addRelationIndexJob(
    relations: { subject: string; relation: string; object: string }[],
  ) {
    if (!relations.length) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Missing relations (subject, relation, object)',
      );
    }
    await this.authorizationQueue.add(
      randomUUID(),
      { relations },
      {
        removeOnComplete: {
          age: 3600,
          count: 1000,
        },
        removeOnFail: {
          age: 24 * 3600,
        },
      },
    );
  }
}
