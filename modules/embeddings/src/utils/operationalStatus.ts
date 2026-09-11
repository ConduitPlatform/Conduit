import {
  GrpcError,
  VectorCapabilities,
  VectorIndexStatus,
} from '@conduitplatform/grpc-sdk';
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
import { providerCatalogueIssues } from './providerConfig.js';
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

export function storagePeerWarnings(args: {
  moduleEnabled: boolean;
  storageAvailable?: boolean;
}): string[] {
  if (!args.moduleEnabled || args.storageAvailable !== false) return [];
  return ['Storage module is unavailable; conduit-storage extraction is idle'];
}

export function storageQueueWarnings(counts?: QueueJobCounts): string[] {
  if (!counts || counts.failed < 1) return [];
  return [
    `Storage extraction queue has ${counts.failed} failed jobs. Inspect document statuses and reconcile the source after fixing MIME, size, or provider errors.`,
  ];
}

export function sourceExtractionWarnings(args: {
  kind: string;
  failedCount: number;
  extractionQueue?: QueueJobCounts;
  storageAvailable?: boolean;
}): string[] {
  if (args.kind !== 'conduit-storage') return [];
  const warnings: string[] = [];
  if (args.storageAvailable === false) {
    warnings.push(
      'Storage module is unavailable; extraction is idle until Storage is serving',
    );
  }
  if (args.failedCount > 0) {
    warnings.push(
      `${args.failedCount} documents failed extraction. Reconcile after fixing MIME, size, or provider errors. Extracted text is not retained.`,
    );
  }
  warnings.push(...storageQueueWarnings(args.extractionQueue));
  return warnings;
}

export function isEmbeddingsReady(args: {
  moduleEnabled: boolean;
  warnings: string[];
}): boolean {
  return args.moduleEnabled && args.warnings.length === 0;
}

export interface EmbeddingSourceWorkload {
  state: string;
  chunkIndexStatus?: string;
}

export interface EmbeddingWorkloadCounts {
  configCount: number;
  enabledConfigCount: number;
  sourceCount: number;
  readySourceCount: number;
  pendingSourceCount: number;
  failedSourceCount: number;
  disabledSourceCount: number;
  revokedSourceCount: number;
  queryableSourceCount: number;
}

export function emptyWorkloadCounts(): EmbeddingWorkloadCounts {
  return {
    configCount: 0,
    enabledConfigCount: 0,
    sourceCount: 0,
    readySourceCount: 0,
    pendingSourceCount: 0,
    failedSourceCount: 0,
    disabledSourceCount: 0,
    revokedSourceCount: 0,
    queryableSourceCount: 0,
  };
}

export function isQueryableGenericSource(source: EmbeddingSourceWorkload): boolean {
  if (source.state !== 'ready') return false;
  const indexStatus = source.chunkIndexStatus;
  if (!indexStatus) return true;
  return indexStatus === VectorIndexStatus.Ready || indexStatus === 'ready';
}

export function countEmbeddingWorkloads(args: {
  configs: ReadonlyArray<{ enabled?: boolean }>;
  sources: readonly EmbeddingSourceWorkload[];
}): EmbeddingWorkloadCounts {
  const counts = emptyWorkloadCounts();
  counts.configCount = args.configs.length;
  for (const config of args.configs) {
    if (config.enabled !== false) counts.enabledConfigCount += 1;
  }
  counts.sourceCount = args.sources.length;
  for (const source of args.sources) {
    switch (source.state) {
      case 'ready':
        counts.readySourceCount += 1;
        if (isQueryableGenericSource(source)) counts.queryableSourceCount += 1;
        break;
      case 'pending':
        counts.pendingSourceCount += 1;
        break;
      case 'failed':
        counts.failedSourceCount += 1;
        break;
      case 'disabled':
        counts.disabledSourceCount += 1;
        break;
      case 'revoked':
        counts.revokedSourceCount += 1;
        break;
      default:
        break;
    }
  }
  return counts;
}

export function configuredWorkloadWarnings(args: {
  enabledConfigs: readonly BackfillConfigGate[];
  indexesForConfig: (config: BackfillConfigGate) => readonly VectorIndexGate[];
  sources: readonly EmbeddingSourceWorkload[];
}): string[] {
  const queryableConfigs = args.enabledConfigs.filter(config => {
    const targetField = config.targetField;
    if (!targetField) return false;
    const contract = embeddingIndexContractFromConfig(config);
    const index = findTargetVectorIndex(
      args.indexesForConfig(config),
      targetField,
      contract,
    );
    return Boolean(contract && isEmbeddingVectorIndexQueryable(index));
  });
  const queryableSources = args.sources.filter(isQueryableGenericSource);
  if (queryableConfigs.length > 0 || queryableSources.length > 0) return [];

  const pendingSources = args.sources.filter(source => source.state === 'pending').length;
  const failedSources = args.sources.filter(source => source.state === 'failed').length;
  const readyUnqueryable = args.sources.filter(
    source => source.state === 'ready' && !isQueryableGenericSource(source),
  ).length;
  const hasConfiguredWorkload =
    args.enabledConfigs.length > 0 ||
    pendingSources > 0 ||
    failedSources > 0 ||
    readyUnqueryable > 0;
  if (!hasConfiguredWorkload) return [];

  const warnings: string[] = [];
  for (const config of args.enabledConfigs) {
    warnings.push(...indexReadinessWarnings([config], args.indexesForConfig(config)));
  }
  if (readyUnqueryable > 0) {
    warnings.push(
      `${readyUnqueryable} ready generic source(s) do not have a queryable chunk index`,
    );
  }
  if (!warnings.length && pendingSources > 0) {
    warnings.push(`${pendingSources} generic source(s) are pending`);
  }
  if (!warnings.length && failedSources > 0) {
    warnings.push(`${failedSources} generic source(s) failed`);
  }
  if (!warnings.length) {
    warnings.push('No queryable embedding config or generic source');
  }
  return warnings;
}
