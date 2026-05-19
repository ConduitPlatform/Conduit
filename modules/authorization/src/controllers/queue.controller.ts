import path from 'path';
import { Queue, Worker } from 'bullmq';
import { randomUUID } from 'crypto';
import { status } from '@grpc/grpc-js';
import { ConduitGrpcSdk, GrpcError } from '@conduitplatform/grpc-sdk';
import { Cluster, Redis } from 'ioredis';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class QueueController {
  private static _instance: QueueController;
  private readonly redisConnection: Redis | Cluster;
  private authorizationQueue: Queue;
  private connectionQueue: Queue;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.redisConnection = this.grpcSdk.redisManager.getClient();
    this.authorizationQueue = this.initializeRelationIndexQueue();
    this.connectionQueue = this.initializeConnectionQueue();
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

  initializeConnectionQueue() {
    return new Queue('authorization-connection-queue', {
      connection: this.redisConnection,
    });
  }

  addRelationIndexWorker() {
    const processorFile = path.normalize(
      path.join(__dirname, '../jobs', 'constructRelationIndex.js'),
    );
    const worker = new Worker('authorization-index-queue', processorFile, {
      concurrency: 5,
      connection: this.redisConnection,
      // autorun: true,
    });
    worker.on('active', job => {
      ConduitGrpcSdk.Logger.info(`Index ${job.id} started`);
    });
    worker.on('completed', job => {
      ConduitGrpcSdk.Logger.info(`Index ${job.id} completed`);
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

  addConnectionWorker() {
    const processorFile = path.normalize(
      path.join(__dirname, '../jobs', 'processPossibleConnections.js'),
    );
    const worker = new Worker('authorization-connection-queue', processorFile, {
      concurrency: 5,
      connection: this.redisConnection,
      removeOnComplete: {
        age: 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 24 * 3600,
      },
      // autorun: true,
    });
    worker.on('active', job => {
      ConduitGrpcSdk.Logger.info(`Connection ${job.id} started`);
    });
    worker.on('completed', job => {
      ConduitGrpcSdk.Logger.info(`Connection ${job.id} completed`);
    });
    worker.on('error', error => {
      ConduitGrpcSdk.Logger.error(`Job error:`);
      ConduitGrpcSdk.Logger.error(error);
    });
    worker.on('failed', (job, error) => {
      ConduitGrpcSdk.Logger.error(`Job error:`);
      ConduitGrpcSdk.Logger.error(error);
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
    await this.authorizationQueue.addBulk(
      relations.map(r => {
        return {
          name: randomUUID(),
          data: {
            relation: r,
          },
        };
      }),
    );
  }

  async addPossibleConnectionJob(
    object: string,
    subject: string,
    relation: string,
    relatedPermissions: { [key: string]: string[] },
    achievedPermissions: string[],
  ) {
    await this.connectionQueue.add(randomUUID(), {
      object,
      subject,
      relation,
      relatedPermissions,
      achievedPermissions,
    });
  }

  async waitForIdle() {
    let waitingCount = await this.authorizationQueue.count();
    while (waitingCount > 0) {
      await ConduitGrpcSdk.Sleep(1000);
      waitingCount = await this.authorizationQueue.count();
    }
    return;
  }
}
