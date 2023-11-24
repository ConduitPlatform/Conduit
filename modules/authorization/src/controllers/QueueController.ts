import path from 'path';
import { Queue, Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, { GrpcError } from '@conduitplatform/grpc-sdk';
import { Redis, Cluster } from 'ioredis';

export class QueueController {
  private static _instance: QueueController;
  private readonly authorizationQueue: Queue;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    const redisConnection = this.grpcSdk.redisManager.getClient();
    this.authorizationQueue = this.initializeRelationIndexQueue(redisConnection);
  }

  getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (QueueController._instance) return QueueController._instance;
    if (grpcSdk) {
      return (QueueController._instance = new QueueController(grpcSdk));
    }
    throw new Error('Missing grpcSdk!');
  }

  initializeRelationIndexQueue(redisConnection: Redis | Cluster) {
    const queue = new Queue('authorization-index-queue', {
      connection: redisConnection,
    });
    const processorFile = path.normalize(
      path.join(__dirname, '../jobs', 'constructRelationIndex.js'),
    );
    new Worker('authorization-index-queue', processorFile, {
      connection: redisConnection,
    });
    return queue;
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
