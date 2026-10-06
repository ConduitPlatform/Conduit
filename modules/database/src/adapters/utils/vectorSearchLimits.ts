import { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

export const VECTOR_SEARCH_DEFAULT_LIMIT = 10;
export const VECTOR_SEARCH_MAX_LIMIT = 1000;
export const VECTOR_SEARCH_MAX_CANDIDATES = 10_000;

export interface VectorSearchLimits {
  limit: number;
  numCandidates: number;
}

function parsePositiveInt(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || !Number.isInteger(numeric) || numeric < 1) {
    throw new GrpcError(status.INVALID_ARGUMENT, `${field} must be a positive integer`);
  }
  return numeric;
}

export function clampVectorSearchLimits(input: {
  limit?: number;
  numCandidates?: number;
}): VectorSearchLimits {
  const parsedLimit = parsePositiveInt(input.limit, 'limit');
  const parsedCandidates = parsePositiveInt(input.numCandidates, 'numCandidates');
  const limit = Math.min(
    parsedLimit ?? VECTOR_SEARCH_DEFAULT_LIMIT,
    VECTOR_SEARCH_MAX_LIMIT,
  );
  const defaultCandidates = Math.max(limit * 10, 100);
  const numCandidates = Math.min(
    parsedCandidates ?? defaultCandidates,
    VECTOR_SEARCH_MAX_CANDIDATES,
  );
  if (numCandidates < limit) {
    throw new GrpcError(
      status.INVALID_ARGUMENT,
      `numCandidates must be at least the requested limit (${limit})`,
    );
  }
  return { limit, numCandidates };
}
