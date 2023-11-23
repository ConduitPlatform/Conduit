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

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly name: string | undefined,
  ) {
    if (!name) throw new Error('Missing queue name!');
    this.redisConnection = this.grpcSdk.redisManager.getClient();
    this.authorizationQueue = new Queue(this.name!, { connection: this.redisConnection });
  }

  getInstance(name?: string, grpcSdk?: ConduitGrpcSdk) {
    if (QueueController._instance) return QueueController._instance;
    if (grpcSdk && name) {
      return (QueueController._instance = new QueueController(grpcSdk, name));
    }
    throw new Error('Missing grpcSdk or Queue name!');
  }

  async relationIndexesJob(subject: string, relation: string, object: string) {
    if (!subject || !relation || !object) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Missing subject, relation or object');
    }
    const processorFile = path.normalize(
      path.join(__dirname, '../jobs', 'constructRelationIndex.js'),
    );
    new Worker(this.name!, processorFile, { connection: this.redisConnection });
    await this.authorizationQueue.add(
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
