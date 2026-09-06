import { GrpcError, VectorCapabilities } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  assertBackfillExecutable,
  BackfillGateError,
  embeddingIndexContractFromConfig,
  findTargetVectorIndex,
  isEmbeddingVectorIndexQueryable,
  type BackfillConfigGate,
  type VectorIndexGate,
} from './backfillGates.js';
import type { QueueJobCounts } from '../controllers/queue.controller.js';

export const SEARCH_GATE_REASONS = [
  'vector_unsupported',
  'vector_search_unavailable',
  'config_not_found',
  'config_disabled',
  'index_not_queryable',
] as const;

export type SearchGateReason = (typeof SEARCH_GATE_REASONS)[number];

export class SearchGateError extends Error {
  readonly code = 'SEARCH_GATE' as const;

  constructor(
    readonly reason: SearchGateReason,
    message: string,
    readonly indexStatus?: string,
  ) {
    super(message);
    this.name = 'SearchGateError';
  }
}

export function assertSearchExecutable(args: {
  capabilities?: Pick<VectorCapabilities, 'supported' | 'search' | 'provider' | 'reason'>;
  config?: BackfillConfigGate | null;
  indexes?: readonly VectorIndexGate[];
}): void {
  const capabilities = args.capabilities;
  if (!capabilities?.supported) {
    throw new SearchGateError(
      'vector_unsupported',
      capabilities?.reason ??
        'Database does not support Conduit vector search; use MongoDB Atlas Vector Search or Postgres pgvector',
    );
  }
  if (!capabilities.search) {
    throw new SearchGateError(
      'vector_search_unavailable',
      capabilities.reason ??
        `Vector search is unavailable for provider '${capabilities.provider}'`,
    );
  }
  if (!args.config) {
    throw new SearchGateError(
      'config_not_found',
      'No enabled embedding config found for semantic search',
    );
  }
  if (args.config.enabled === false) {
    throw new SearchGateError(
      'config_disabled',
      `Embedding config '${args.config._id ?? 'unknown'}' is disabled`,
    );
  }
  const targetField = args.config.targetField;
  if (typeof targetField !== 'string' || !targetField.length) {
    throw new SearchGateError(
      'config_not_found',
      'Embedding config is missing a target vector field',
    );
  }
  const contract = embeddingIndexContractFromConfig(args.config);
  const index = findTargetVectorIndex(args.indexes ?? [], targetField, contract);
  if (contract && isEmbeddingVectorIndexQueryable(index)) return;
  const indexStatus = contract ? (index?.status ?? 'missing') : 'missing';
  throw new SearchGateError(
    'index_not_queryable',
    `Vector index for field '${targetField}' is not queryable (status: ${indexStatus}). ` +
      'Wait until the index is ready before running semantic search.',
    indexStatus,
  );
}

export function grpcErrorFromSearchGate(err: SearchGateError): GrpcError {
  switch (err.reason) {
    case 'vector_unsupported':
    case 'vector_search_unavailable':
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

export function capabilityWarnings(
  capabilities?: Pick<
    VectorCapabilities,
    'supported' | 'storage' | 'indexing' | 'search' | 'provider' | 'reason'
  >,
): string[] {
  if (!capabilities) {
    return ['Vector capabilities are unavailable'];
  }
  const warnings: string[] = [];
  if (!capabilities.supported) {
    warnings.push(
      capabilities.reason ??
        `Vector storage is unsupported for provider '${capabilities.provider}'`,
    );
    return warnings;
  }
  if (!capabilities.storage) {
    warnings.push(
      capabilities.reason ??
        `Vector storage is unavailable for provider '${capabilities.provider}'`,
    );
  }
  if (!capabilities.indexing) {
    warnings.push(
      capabilities.reason ??
        `Vector indexing is unavailable for provider '${capabilities.provider}'`,
    );
  }
  if (!capabilities.search) {
    warnings.push(
      capabilities.reason ??
        `Vector search is unavailable for provider '${capabilities.provider}'`,
    );
  }
  return warnings;
}

export function indexReadinessWarnings(
  configs: readonly BackfillConfigGate[],
  indexes: readonly VectorIndexGate[],
): string[] {
  const warnings: string[] = [];
  for (const config of configs) {
    const targetField = config.targetField;
    if (!targetField) continue;
    const contract = embeddingIndexContractFromConfig(config);
    const index = findTargetVectorIndex(indexes, targetField, contract);
    if (contract && isEmbeddingVectorIndexQueryable(index)) continue;
    warnings.push(
      `Vector index for field '${targetField}' is not queryable (status: ${
        contract ? (index?.status ?? 'missing') : 'missing'
      })`,
    );
  }
  return warnings;
}

export function providerReadinessWarnings(provider?: {
  endpoint?: string;
  apiKey?: string;
  allowedHosts?: string[];
}): string[] {
  const warnings: string[] = [];
  if (!provider?.endpoint) {
    warnings.push('Embedding provider endpoint is not configured');
  }
  if (!provider?.apiKey) {
    warnings.push('Embedding provider API key is not configured');
  }
  if (!provider?.allowedHosts?.length) {
    warnings.push('Embedding provider host allowlist is empty');
  }
  return warnings;
}

export function assertConfigActivation(args: {
  moduleEnabled: boolean;
  capabilities?: Pick<
    VectorCapabilities,
    'supported' | 'storage' | 'provider' | 'reason'
  >;
  config?: BackfillConfigGate | null;
  indexes?: readonly VectorIndexGate[];
}): void {
  try {
    assertBackfillExecutable({
      moduleEnabled: args.moduleEnabled,
      capabilities: args.capabilities,
      config: args.config,
      indexes: args.indexes,
    });
  } catch (err) {
    if (err instanceof BackfillGateError && err.reason === 'index_not_queryable') {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        `${err.message} Save the config with enabled=false until the index is ready.`,
      );
    }
    throw err;
  }
}

export function emptyQueueCounts(): QueueJobCounts {
  return {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
    paused: 0,
  };
}

export function isEmbeddingsReady(args: {
  moduleEnabled: boolean;
  warnings: string[];
}): boolean {
  return args.moduleEnabled && args.warnings.length === 0;
}
