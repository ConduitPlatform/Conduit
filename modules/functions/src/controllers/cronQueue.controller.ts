import { Job, Queue, Worker } from 'bullmq';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { Cluster, Redis } from 'ioredis';
import { Functions } from '../models/index.js';
import {
  buildCronJobId,
  getCronPatternFromInputs,
  validateCronPattern,
} from './cron.utils.js';
import type { CompiledUserFunction } from '../sandbox/functionSandbox.js';
import { compileFunctionCode, executeBackgroundFunction } from './utils.js';

const CRON_QUEUE_NAME = 'functions-cron-queue';
const CRON_JOB_NAME = 'execute-cron';

export class CronQueueController {
  private static _instance: CronQueueController;
  private readonly redisConnection: Redis | Cluster;
  private readonly cronQueue: Queue;
  private cronWorker?: Worker;
  private compiledFunctions = new Map<string, CompiledUserFunction>();

  private constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.redisConnection = this.grpcSdk.redisManager.getClient();
    this.cronQueue = new Queue(CRON_QUEUE_NAME, {
      connection: this.redisConnection,
    });
  }

  static getInstance(grpcSdk?: ConduitGrpcSdk): CronQueueController {
    if (CronQueueController._instance) {
      return CronQueueController._instance;
    }
    if (!grpcSdk) {
      throw new Error('No grpcSdk instance provided!');
    }
    CronQueueController._instance = new CronQueueController(grpcSdk);
    return CronQueueController._instance;
  }

  setCompiledFunctions(compiled: Map<string, CompiledUserFunction>): void {
    this.compiledFunctions = compiled;
  }

  ensureWorker(): Worker {
    if (this.cronWorker) {
      return this.cronWorker;
    }
    this.cronWorker = new Worker(
      CRON_QUEUE_NAME,
      async (job: Job<{ functionId: string }>) => {
        const func = await Functions.getInstance().findOne(
          { _id: job.data.functionId },
          { readPreference: 'primary' },
        );
        if (!func || func.functionType !== 'cron') {
          return;
        }
        const cronPattern = getCronPatternFromInputs(func.inputs);
        if (!cronPattern) {
          ConduitGrpcSdk.Logger.warn(
            `Cron function ${func.name} (${func._id}) has no pattern; skipping tick`,
          );
          return;
        }
        const compiled =
          this.compiledFunctions.get(func._id) ?? compileFunctionCode(func.functionCode);
        const scheduledAt = new Date().toISOString();
        ConduitGrpcSdk.Logger.log(
          `Cron tick for ${func.name} (${cronPattern}) at ${scheduledAt}`,
        );
        await executeBackgroundFunction(
          func,
          {
            scheduledAt,
            cronPattern,
            trigger: 'cron',
          },
          compiled,
          this.grpcSdk,
        );
        ConduitGrpcSdk.Logger.log(`Cron execution completed for ${func.name}`);
      },
      {
        concurrency: 1,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
        connection: this.redisConnection,
      },
    );
    this.setupWorkerEventHandlers(this.cronWorker);
    return this.cronWorker;
  }

  async syncCronJobs(cronFunctions: Functions[]): Promise<void> {
    this.ensureWorker();
    const repeatables = await this.cronQueue.getRepeatableJobs();
    const expectedJobIds = new Set(cronFunctions.map(func => buildCronJobId(func._id)));

    let removed = 0;
    for (const repeatable of repeatables) {
      if (!repeatable.id || !expectedJobIds.has(repeatable.id)) {
        try {
          await this.cronQueue.removeRepeatableByKey(repeatable.key);
          removed += 1;
        } catch (err) {
          ConduitGrpcSdk.Logger.error(
            `Failed to remove orphan cron job ${repeatable.id}: ${(err as Error).message}`,
          );
        }
      }
    }

    let registered = 0;
    let updated = 0;
    let unchanged = 0;
    let skipped = 0;
    let errors = 0;
    const currentRepeatables = await this.cronQueue.getRepeatableJobs();
    for (const func of cronFunctions) {
      const pattern = getCronPatternFromInputs(func.inputs);
      if (!pattern) {
        ConduitGrpcSdk.Logger.warn(
          `Cron function ${func.name} (${func._id}) missing pattern; skipping schedule`,
        );
        skipped += 1;
        continue;
      }
      try {
        validateCronPattern(pattern);
      } catch (err) {
        ConduitGrpcSdk.Logger.error(
          `Cron function ${func.name} (${func._id}) has invalid pattern "${pattern}": ${(err as Error).message}`,
        );
        skipped += 1;
        continue;
      }

      const jobId = buildCronJobId(func._id);
      const timezone = func.inputs?.timezone ?? 'UTC';
      const existing = currentRepeatables.find(r => r.id === jobId);

      if (existing && existing.pattern === pattern && existing.tz === timezone) {
        unchanged += 1;
        continue;
      }

      try {
        if (existing) {
          await this.cronQueue.removeRepeatableByKey(existing.key);
          updated += 1;
        } else {
          registered += 1;
        }

        await this.cronQueue.add(
          CRON_JOB_NAME,
          { functionId: func._id },
          {
            jobId,
            repeat: { pattern, tz: timezone },
            removeOnComplete: { age: 3600, count: 1000 },
            removeOnFail: { age: 24 * 3600 },
          },
        );
      } catch (err) {
        ConduitGrpcSdk.Logger.error(
          `Failed to schedule cron job for ${func.name} (${func._id}): ${(err as Error).message}`,
        );
        errors += 1;
        if (existing) {
          updated -= 1;
        } else {
          registered -= 1;
        }
      }
    }

    ConduitGrpcSdk.Logger.log(
      `Cron sync complete: registered=${registered}, updated=${updated}, unchanged=${unchanged}, removed=${removed}, skipped=${skipped}, errors=${errors}`,
    );
  }

  async drainCronQueue(): Promise<void> {
    if (this.cronWorker) {
      await this.cronWorker.close();
      this.cronWorker = undefined;
    }
    await this.cronQueue.drain();
    const repeatables = await this.cronQueue.getRepeatableJobs();
    for (const job of repeatables) {
      await this.cronQueue.removeRepeatableByKey(job.key);
    }
    this.compiledFunctions.clear();
  }

  private setupWorkerEventHandlers(worker: Worker): void {
    worker.on('error', (error: Error) => {
      ConduitGrpcSdk.Logger.error('Functions cron worker error:');
      ConduitGrpcSdk.Logger.error(error);
    });
    worker.on('failed', (job: Job | undefined, error: Error) => {
      ConduitGrpcSdk.Logger.error(
        job
          ? `Cron job failed: ${job.id}, ${error.message}`
          : `Cron job error: ${error.message}`,
      );
    });
  }
}
