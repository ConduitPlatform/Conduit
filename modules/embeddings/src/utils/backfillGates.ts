import {
  GrpcError,
  VectorCapabilities,
  VectorIndexStatus,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';

export const BACKFILL_GATE_REASONS = [
  'module_disabled',
  'vector_unsupported',
  'vector_storage_unavailable',
  'config_not_found',
  'config_disabled',
  'index_not_queryable',
] as const;

export type BackfillGateReason = (typeof BACKFILL_GATE_REASONS)[number];

export class BackfillGateError extends Error {
  readonly code = 'BACKFILL_GATE' as const;

  constructor(
    readonly reason: BackfillGateReason,
    message: string,
    readonly indexStatus?: string,
  ) {
    super(message);
    this.name = 'BackfillGateError';
  }
}

export interface BackfillConfigGate {
  _id?: string;
  enabled?: boolean;
  schemaName?: string;
  targetField?: string;
}

export interface VectorIndexGate {
  field?: string;
  name?: string;
  queryable?: boolean;
  status?: string;
}

export function isEmbeddingVectorIndexQueryable(index?: VectorIndexGate): boolean {
  if (!index) return false;
  if (index.queryable === false) return false;
  const indexStatus = index.status?.toLowerCase();
  if (indexStatus === VectorIndexStatus.Failed || indexStatus === 'failed') {
    return false;
  }
  if (
    (indexStatus === VectorIndexStatus.Pending || indexStatus === 'pending') &&
    index.queryable !== true
  ) {
    return false;
  }
  return true;
}

export function findTargetVectorIndex(
  indexes: readonly VectorIndexGate[],
  targetField: string,
): VectorIndexGate | undefined {
  return (
    indexes.find(
      index => index.field === targetField && index.name === `${targetField}_vector`,
    ) ?? indexes.find(index => index.field === targetField)
  );
}

export function assertBackfillExecutable(args: {
  moduleEnabled: boolean;
  capabilities?: Pick<
    VectorCapabilities,
    'supported' | 'storage' | 'provider' | 'reason'
  >;
  config?: BackfillConfigGate | null;
  indexes?: readonly VectorIndexGate[];
}): void {
  if (!args.moduleEnabled) {
    throw new BackfillGateError(
      'module_disabled',
      'Embeddings module is disabled; enable it before starting a backfill',
    );
  }
  const capabilities = args.capabilities;
  if (!capabilities?.supported) {
    throw new BackfillGateError(
      'vector_unsupported',
      capabilities?.reason ??
        'Database does not support Conduit vector storage; use MongoDB Atlas Vector Search or Postgres pgvector',
    );
  }
  if (!capabilities.storage) {
    throw new BackfillGateError(
      'vector_storage_unavailable',
      capabilities.reason ??
        `Vector storage is unavailable for provider '${capabilities.provider}'`,
    );
  }
  if (!args.config) {
    throw new BackfillGateError(
      'config_not_found',
      'No enabled embedding config found for backfill',
    );
  }
  if (args.config.enabled === false) {
    throw new BackfillGateError(
      'config_disabled',
      `Embedding config '${args.config._id ?? 'unknown'}' is disabled`,
    );
  }
  const targetField = args.config.targetField;
  if (typeof targetField !== 'string' || !targetField.length) {
    throw new BackfillGateError(
      'config_not_found',
      'Embedding config is missing a target vector field',
    );
  }
  const index = findTargetVectorIndex(args.indexes ?? [], targetField);
  if (isEmbeddingVectorIndexQueryable(index)) return;
  const indexStatus = index?.status ?? 'missing';
  throw new BackfillGateError(
    'index_not_queryable',
    `Vector index for field '${targetField}' is not queryable (status: ${indexStatus}). ` +
      'Wait until the index is ready before running a backfill.',
    indexStatus,
  );
}

export function grpcErrorFromBackfillGate(err: BackfillGateError): GrpcError {
  switch (err.reason) {
    case 'module_disabled':
    case 'vector_unsupported':
    case 'vector_storage_unavailable':
    case 'config_not_found':
    case 'config_disabled':
    case 'index_not_queryable':
      return new GrpcError(status.FAILED_PRECONDITION, err.message);
    default: {
      const unexpected: never = err.reason;
      return new GrpcError(status.INTERNAL, String(unexpected));
    }
  }
}
