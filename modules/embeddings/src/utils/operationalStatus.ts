import {
  parseErrorPayload,
  VectorCapabilities,
  type ModuleErrorDefinition,
} from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import {
  assertBackfillExecutable,
  BackfillGateError,
  embeddingIndexContractFromConfig,
  findTargetVectorIndex,
  isEmbeddingVectorIndexQueryable,
  type BackfillConfigGate,
  type VectorIndexGate,
} from './backfillGates.js';
import { providerCatalogueIssues } from './providerConfig.js';
import type { QueueJobCounts } from '../controllers/queue.controller.js';

export const SEARCH_GATE_REASONS = [
  'module_disabled',
  'vector_unsupported',
  'vector_search_unavailable',
  'config_not_found',
  'config_disabled',
  'index_not_queryable',
] as const;

export type SearchGateReason = (typeof SEARCH_GATE_REASONS)[number];

/** Single place mapping a search gate reason to its catalog entry. */
export const SEARCH_GATE_DEFINITIONS: Record<SearchGateReason, ModuleErrorDefinition> = {
  module_disabled: errors.EMBEDDINGS_MODULE_DISABLED,
  vector_unsupported: errors.VECTOR_SEARCH_UNSUPPORTED,
  vector_search_unavailable: errors.VECTOR_UNAVAILABLE,
  config_not_found: errors.ENABLED_EMBEDDING_CONFIG_NOT_FOUND,
  config_disabled: errors.EMBEDDING_CONFIG_UNUSABLE,
  index_not_queryable: errors.VECTOR_INDEX_NOT_QUERYABLE,
};

/**
 * A failed search precondition. It is a typed `ModuleError`, so routes and gRPC answer
 * with its catalog code. `message` (optional) replaces the catalog message.
 */
export class SearchGateError extends ModuleError {
  constructor(
    readonly reason: SearchGateReason,
    message?: string,
    readonly indexStatus?: string,
    definition: ModuleErrorDefinition = SEARCH_GATE_DEFINITIONS[reason],
  ) {
    super(message ? { ...definition, message } : definition);
    this.name = 'SearchGateError';
  }
}

export function assertSearchExecutable(args: {
  moduleEnabled: boolean;
  capabilities?: Pick<VectorCapabilities, 'supported' | 'search' | 'provider' | 'reason'>;
  config?: BackfillConfigGate | null;
  indexes?: readonly VectorIndexGate[];
}): void {
  if (!args.moduleEnabled) {
    throw new SearchGateError(
      'module_disabled',
      'Embeddings module is disabled; enable it before running semantic search',
    );
  }
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
      'config_disabled',
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
  models?: Array<{ name?: string; dimensions?: number }>;
  defaultModel?: string;
}): string[] {
  const warnings: string[] = [];
  if (!provider?.endpoint) {
    warnings.push('Embedding provider endpoint is not configured');
  }
  if (!provider?.apiKey) {
    warnings.push('Embedding provider API key is not configured');
  }
  warnings.push(...providerCatalogueIssues(provider));
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
      throw new ModuleError({
        ...errors.VECTOR_INDEX_NOT_QUERYABLE,
        message: `${parseErrorPayload(err).message} Save the config with enabled=false until the index is ready.`,
      });
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
