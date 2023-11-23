import path from 'path';
import { Queue, Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, { GrpcError } from '@conduitplatform/grpc-sdk';
import { Redis, Cluster } from 'ioredis';

export class QueueController {
  private static _instance: QueueController;
  private readonly redisConnection: Redis | Cluster;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.redisConnection = this.grpcSdk.redisManager.getClient();
  }

  getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (QueueController._instance) return QueueController._instance;
    if (grpcSdk) {
      return (QueueController._instance = new QueueController(grpcSdk));
    }
    throw new Error('Missing grpcSdk!');
  }

  async relationIndexesJob(subject: string, relation: string, object: string) {
    if (!subject || !relation || !object) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Missing subject, relation or object');
    }
    const authorizationQueue = new Queue('authorization-index-queue', {
      connection: this.redisConnection,
    });
    const processorFile = path.normalize(
      path.join(__dirname, '../jobs', 'constructRelationIndex.js'),
    );
    new Worker('authorization-index-queue', processorFile, {
      connection: this.redisConnection,
    });
    await authorizationQueue.add(
      randomUUID(),
      { subject, relation, object },
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
