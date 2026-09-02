import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import cronParser from 'cron-parser';
import type { IWebInputsInterface } from '../interfaces/IWebInputs.interface.js';

export function buildCronJobId(functionId: string): string {
  return `cron-${functionId}`;
}

export function getCronPatternFromInputs(
  inputs?: IWebInputsInterface | null,
): string | undefined {
  if (!inputs) return undefined;
  const pattern = inputs.cronPattern ?? inputs.event;
  if (typeof pattern !== 'string') return undefined;
  const trimmed = pattern.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getCronTimezone(inputs?: IWebInputsInterface | null): string {
  const timezone = inputs?.timezone?.trim();
  return timezone && timezone.length > 0 ? timezone : 'UTC';
}

export function validateCronPattern(pattern: string, timezone = 'UTC'): void {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Invalid timezone: "${timezone}". Use an IANA name (e.g. UTC, Europe/Athens).`,
    );
  }
  try {
    cronParser.parseExpression(pattern, { tz: timezone });
  } catch {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Invalid cron pattern: "${pattern}". Expected 5-field format: minute hour day month weekday (${timezone}).`,
    );
  }
}

export function normalizeCronInputs(
  inputs: IWebInputsInterface | undefined,
): IWebInputsInterface {
  const pattern = getCronPatternFromInputs(inputs);
  if (!pattern) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      'Cron pattern is required (inputs.cronPattern or inputs.event)',
    );
  }
  const timezone = getCronTimezone(inputs);
  validateCronPattern(pattern, timezone);
  const normalized: IWebInputsInterface = {
    ...inputs,
    cronPattern: pattern,
    timezone,
  };
  // event is the bus channel; do not persist the cron expression there.
  if (normalized.event === pattern) {
    delete normalized.event;
  }
  return normalized;
}

export type RepeatableJobView = {
  id?: string | null;
  key: string;
  pattern?: string | null;
  tz?: string | null;
};

export type CronFunctionView = {
  _id: string;
  name: string;
  inputs?: IWebInputsInterface | null;
};

export type CronSyncPlan = {
  orphanKeys: string[];
  toSchedule: Array<{
    functionId: string;
    jobId: string;
    pattern: string;
    timezone: string;
    existingKey?: string;
  }>;
  unchangedJobIds: string[];
  skipped: Array<{ functionId: string; reason: string }>;
};

export function planCronSync(
  cronFunctions: CronFunctionView[],
  repeatables: RepeatableJobView[],
): CronSyncPlan {
  const expectedJobIds = new Set(cronFunctions.map(func => buildCronJobId(func._id)));
  const orphanKeys = repeatables
    .filter(repeatable => !repeatable.id || !expectedJobIds.has(repeatable.id))
    .map(repeatable => repeatable.key);

  const toSchedule: CronSyncPlan['toSchedule'] = [];
  const unchangedJobIds: string[] = [];
  const skipped: CronSyncPlan['skipped'] = [];

  for (const func of cronFunctions) {
    const pattern = getCronPatternFromInputs(func.inputs);
    if (!pattern) {
      skipped.push({ functionId: func._id, reason: 'missing pattern' });
      continue;
    }
    const timezone = getCronTimezone(func.inputs);
    try {
      validateCronPattern(pattern, timezone);
    } catch {
      skipped.push({ functionId: func._id, reason: 'invalid pattern' });
      continue;
    }

    const jobId = buildCronJobId(func._id);
    const existing = repeatables.find(repeatable => repeatable.id === jobId);
    if (existing && existing.pattern === pattern && existing.tz === timezone) {
      unchangedJobIds.push(jobId);
      continue;
    }

    toSchedule.push({
      functionId: func._id,
      jobId,
      pattern,
      timezone,
      existingKey: existing?.key,
    });
  }

  return { orphanKeys, toSchedule, unchangedJobIds, skipped };
}
