import { Queue, Worker } from 'bullmq';
import { Cluster, Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';

export interface EmbeddingJobData {
  schemaName: string;
  documentId: string;
  configId?: string;
}

export class QueueController {
  private static _instance: QueueController;
  private readonly redisConnection: Redis | Cluster;
  private readonly embeddingQueue: Queue<EmbeddingJobData>;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.redisConnection = this.grpcSdk.redisManager.getClient();
    this.embeddingQueue = new Queue<EmbeddingJobData>('embeddings-generation-queue', {
      connection: this.redisConnection,
    });
  }

  static getInstance(grpcSdk?: ConduitGrpcSdk) {
    if (QueueController._instance) return QueueController._instance;
    if (!grpcSdk) throw new Error('No grpcSdk instance provided!');
    return (QueueController._instance = new QueueController(grpcSdk));
  }

  addWorker(processor: (data: EmbeddingJobData) => Promise<void>, concurrency: number) {
    const worker = new Worker<EmbeddingJobData>(
      'embeddings-generation-queue',
      job => processor(job.data),
      {
        concurrency,
        connection: this.redisConnection,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
      },
    );
    worker.on('failed', (_job, error) => ConduitGrpcSdk.Logger.error(error));
    worker.on('error', error => ConduitGrpcSdk.Logger.error(error));
    return worker;
  }

  async addEmbeddingJob(data: EmbeddingJobData, attempts: number) {
    await this.embeddingQueue.add(randomUUID(), data, {
      attempts,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }

  async addBulkEmbeddingJobs(data: EmbeddingJobData[], attempts: number) {
    await this.embeddingQueue.addBulk(
      data.map(job => ({
        name: randomUUID(),
        data: job,
        opts: {
          attempts,
          backoff: { type: 'exponential', delay: 1000 },
        },
      })),
    );
  }
}
