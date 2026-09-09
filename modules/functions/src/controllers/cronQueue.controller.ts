import { Job, Queue, Worker, type RepeatableJob } from 'bullmq';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import { Cluster, Redis } from 'ioredis';
import { Functions } from '../models/index.js';
import { getCronPatternFromInputs, planCronSync } from './cron.utils.js';
import type { CompiledUserFunction } from '../sandbox/functionSandbox.js';
import {
  compileFunctionCode,
  executeBackgroundFunction,
  filterSchedulableCronFunctions,
} from './utils.js';

const CRON_QUEUE_NAME = 'functions-cron-queue';
const CRON_JOB_NAME = 'execute-cron';
const CRON_SYNC_LOCK = 'functions-cron-sync';
const CRON_SYNC_LOCK_TTL_MS = 60_000;
const DEFAULT_FUNCTION_TIMEOUT_MS = 180_000;
const LOCK_BUFFER_MS = 60_000;

export class CronQueueController {
  private static _instance: CronQueueController;
  private readonly redisConnection: Redis | Cluster;
  private readonly cronQueue: Queue;
  private cronWorker?: Worker;
  private workerLockDuration = 0;
  private cronEnabled = true;
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

  enableCronScheduling(): void {
    this.cronEnabled = true;
  }

  private shouldSchedule(): boolean {
    return this.cronEnabled && ConfigController.getInstance().config.active;
  }

  async listRepeatableJobs(): Promise<RepeatableJob[]> {
    return this.cronQueue.getRepeatableJobs();
  }

  async ensureWorker(lockDuration: number): Promise<Worker | undefined> {
    if (!this.shouldSchedule()) {
      return this.cronWorker;
    }
    if (this.cronWorker && this.workerLockDuration >= lockDuration) {
      return this.cronWorker;
    }
    if (this.cronWorker) {
      await this.cronWorker.close();
      this.cronWorker = undefined;
      this.workerLockDuration = 0;
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
        lockDuration,
        maxStalledCount: 0,
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 24 * 3600 },
        connection: this.redisConnection,
      },
    );
    this.workerLockDuration = lockDuration;
    this.setupWorkerEventHandlers(this.cronWorker);
    if (!this.shouldSchedule()) {
      await this.cronWorker.close();
      this.cronWorker = undefined;
      this.workerLockDuration = 0;
      return undefined;
    }
    return this.cronWorker;
  }

  async syncCronJobs(): Promise<void> {
    if (!this.shouldSchedule()) {
      await this.clearRedisSchedule();
      return;
    }
    let lockDuration = DEFAULT_FUNCTION_TIMEOUT_MS + LOCK_BUFFER_MS;
    try {
      const reconciled = await this.withCronSyncLock(async () => {
        if (!this.shouldSchedule()) return;
        lockDuration = await this.reconcileCronJobs();
      });
      if (reconciled === false && this.shouldSchedule()) {
        lockDuration = await this.lockDurationForCronFunctions();
      }
    } catch (err) {
      ConduitGrpcSdk.Logger.error(`Cron sync failed: ${(err as Error).message}`);
      try {
        if (this.shouldSchedule()) {
          lockDuration = await this.lockDurationForCronFunctions();
        }
      } catch {
        // keep default lock duration
      }
    }
    if (!this.shouldSchedule()) {
      await this.clearRedisSchedule();
      return;
    }
    await this.ensureWorker(lockDuration);
  }

  // Cluster-wide off: disable first, close the local worker outside the lock,
  // then clear shared Redis repeatables/delayed jobs under the sync lock.
  async drainCronQueue(): Promise<void> {
    this.cronEnabled = false;
    if (this.cronWorker) {
      await this.cronWorker.close();
      this.cronWorker = undefined;
      this.workerLockDuration = 0;
    }
    this.compiledFunctions.clear();
    await this.withCronSyncLock(() => this.clearRedisSchedule());
  }

  private async clearRedisSchedule(): Promise<void> {
    const repeatables = await this.cronQueue.getRepeatableJobs();
    for (const job of repeatables) {
      try {
        await this.cronQueue.removeRepeatableByKey(job.key);
      } catch (err) {
        ConduitGrpcSdk.Logger.error(
          `Failed to remove cron job ${job.key}: ${(err as Error).message}`,
        );
      }
    }
    await this.cronQueue.drain(true);
  }

  private async withCronSyncLock(fn: () => Promise<void>): Promise<boolean> {
    const state = this.grpcSdk.state;
    if (!state) {
      await fn();
      return true;
    }
    let lock;
    try {
      lock = await state.tryAcquireLock(CRON_SYNC_LOCK, CRON_SYNC_LOCK_TTL_MS);
    } catch (err) {
      ConduitGrpcSdk.Logger.error(
        `Failed to acquire cron sync lock: ${(err as Error).message}; continuing without lock`,
      );
      await fn();
      return true;
    }
    if (!lock) {
      ConduitGrpcSdk.Logger.log('Skipping cron sync; another replica holds the lock');
      return false;
    }
    try {
      await fn();
      return true;
    } finally {
      try {
        await state.releaseLock(lock);
      } catch (err) {
        ConduitGrpcSdk.Logger.error(
          `Failed to release cron sync lock: ${(err as Error).message}`,
        );
      }
    }
  }

  private async lockDurationForCronFunctions(): Promise<number> {
    type CronTimeout = Pick<Functions, 'timeout'>;
    const cronDocs = (await Functions.getInstance().findMany(
      { functionType: 'cron' },
      { select: 'timeout', readPreference: 'primary' },
    )) as CronTimeout[];
    const maxTimeout = cronDocs.reduce(
      (max, func) => Math.max(max, func.timeout ?? DEFAULT_FUNCTION_TIMEOUT_MS),
      DEFAULT_FUNCTION_TIMEOUT_MS,
    );
    return maxTimeout + LOCK_BUFFER_MS;
  }

  private lockDurationFromFunctions(cronFunctions: Functions[]): number {
    const maxTimeout = cronFunctions.reduce(
      (max, func) => Math.max(max, func.timeout ?? DEFAULT_FUNCTION_TIMEOUT_MS),
      DEFAULT_FUNCTION_TIMEOUT_MS,
    );
    return maxTimeout + LOCK_BUFFER_MS;
  }

  private async reconcileCronJobs(): Promise<number> {
    const cronDocs = await Functions.getInstance().findMany(
      { functionType: 'cron' },
      { readPreference: 'primary' },
    );
    const cronFunctions = filterSchedulableCronFunctions(cronDocs);

    const repeatables = await this.cronQueue.getRepeatableJobs();
    const plan = planCronSync(cronFunctions, repeatables);

    let removed = 0;
    for (const key of plan.orphanKeys) {
      try {
        await this.cronQueue.removeRepeatableByKey(key);
        removed += 1;
      } catch (err) {
        ConduitGrpcSdk.Logger.error(
          `Failed to remove orphan cron job ${key}: ${(err as Error).message}`,
        );
      }
    }

    let registered = 0;
    let updated = 0;
    let errors = 0;
    for (const item of plan.toSchedule) {
      try {
        if (item.existingKey) {
          await this.cronQueue.removeRepeatableByKey(item.existingKey);
          updated += 1;
        } else {
          registered += 1;
        }
        await this.cronQueue.add(
          CRON_JOB_NAME,
          { functionId: item.functionId },
          {
            jobId: item.jobId,
            repeat: { pattern: item.pattern, tz: item.timezone },
            removeOnComplete: { age: 3600, count: 1000 },
            removeOnFail: { age: 24 * 3600 },
          },
        );
      } catch (err) {
        ConduitGrpcSdk.Logger.error(
          `Failed to schedule cron job ${item.jobId}: ${(err as Error).message}`,
        );
        errors += 1;
        if (item.existingKey) {
          updated -= 1;
        } else {
          registered -= 1;
        }
      }
    }

    ConduitGrpcSdk.Logger.log(
      `Cron sync complete: registered=${registered}, updated=${updated}, unchanged=${plan.unchangedJobIds.length}, removed=${removed}, skipped=${plan.skipped.length}, errors=${errors}`,
    );
    return this.lockDurationFromFunctions(cronFunctions);
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
