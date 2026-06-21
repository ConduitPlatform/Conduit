import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { parseExpression } from 'cron-parser';
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

export function validateCronPattern(pattern: string): void {
  try {
    parseExpression(pattern, { tz: 'UTC' });
  } catch {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `Invalid cron pattern: "${pattern}". Expected 5-field format: minute hour day month weekday (UTC).`,
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
  validateCronPattern(pattern);
  return {
    ...inputs,
    cronPattern: pattern,
    event: pattern,
  };
}
