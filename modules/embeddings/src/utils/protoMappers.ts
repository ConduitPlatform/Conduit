import type { VectorCapabilities, VectorSearchResult } from '@conduitplatform/grpc-sdk';
import type { QueueJobCounts } from '../controllers/queue.controller.js';
import type { PersistedBackfillRun } from './backfillExecution.js';

export function toIsoString(value?: Date | string | null): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  if (typeof value === 'string' && value.length > 0) return value;
  return undefined;
}

export function parseJsonObject(
  value: string | undefined,
  field: string,
): Record<string, unknown> | undefined {
  if (value == null || value === '') return undefined;
  try {
    const parsed = JSON.parse(value);
    if (parsed == null) return undefined;
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not-object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(field);
  }
}

export interface MappedEmbeddingConfig {
  id: string;
  schemaName: string;
  sourceFields: string[];
  targetField: string;
  provider: string;
  model: string;
  dimensions: number;
  similarity: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface MappedBackfillRun {
  id: string;
  schemaName: string;
  configId?: string;
  state: string;
  cursor?: string;
  batchSize: number;
  onlyMissing: boolean;
  filter?: string;
  scannedCount: number;
  queuedCount: number;
  processedCount: number;
  failedCount: number;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function mapEmbeddingConfig(doc: {
  _id: string;
  schemaName: string;
  sourceFields: string[];
  targetField: string;
  provider: string;
  modelName?: string;
  dimensions: number;
  similarity: string;
  enabled?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}): MappedEmbeddingConfig {
  return {
    id: doc._id,
    schemaName: doc.schemaName,
    sourceFields: [...doc.sourceFields],
    targetField: doc.targetField,
    provider: doc.provider,
    model: doc.modelName ?? '',
    dimensions: doc.dimensions,
    similarity: doc.similarity,
    enabled: doc.enabled !== false,
    createdAt: toIsoString(doc.createdAt),
    updatedAt: toIsoString(doc.updatedAt),
  };
}

export function mapBackfillRun(
  run: PersistedBackfillRun & { createdAt?: Date | string; updatedAt?: Date | string },
): MappedBackfillRun {
  return {
    id: run._id,
    schemaName: run.schemaName,
    ...(run.configId ? { configId: run.configId } : {}),
    state: run.state,
    ...(run.cursor ? { cursor: run.cursor } : {}),
    batchSize: run.batchSize,
    onlyMissing: run.onlyMissing === true,
    ...(run.filter ? { filter: JSON.stringify(run.filter) } : {}),
    scannedCount: run.scannedCount,
    queuedCount: run.queuedCount,
    processedCount: run.processedCount,
    failedCount: run.failedCount,
    startedAt: toIsoString(run.startedAt),
    finishedAt: toIsoString(run.finishedAt),
    ...(run.error ? { error: run.error } : {}),
    createdAt: toIsoString(run.createdAt),
    updatedAt: toIsoString(run.updatedAt),
  };
}

export function mapQueueCounts(counts: QueueJobCounts) {
  return {
    waiting: counts.waiting,
    active: counts.active,
    completed: counts.completed,
    failed: counts.failed,
    delayed: counts.delayed,
    paused: counts.paused,
  };
}

export function mapCapabilities(capabilities: VectorCapabilities) {
  return {
    supported: capabilities.supported,
    storage: capabilities.storage,
    indexing: capabilities.indexing,
    search: capabilities.search,
    provider: capabilities.provider,
    ...(capabilities.reason ? { reason: capabilities.reason } : {}),
  };
}

export function mapSearchHits<T>(results: VectorSearchResult<T>[]): Array<{
  document: string;
  score: number;
  distance?: number;
  metric?: string;
  provider?: string;
}> {
  return results.map(result => ({
    document: JSON.stringify(result.document ?? {}),
    score: result.score,
    ...(result.distance != null ? { distance: result.distance } : {}),
    ...(result.metric ? { metric: result.metric } : {}),
    ...(result.provider ? { provider: result.provider } : {}),
  }));
}

export function parseSearchHits<T>(
  hits: Array<{
    document: string;
    score: number;
    distance?: number;
    metric?: string;
    provider?: string;
  }>,
): VectorSearchResult<T>[] {
  return hits.map(hit => ({
    document: JSON.parse(hit.document) as T,
    score: hit.score,
    ...(hit.distance != null ? { distance: hit.distance } : {}),
    ...(hit.metric ? { metric: hit.metric as VectorSearchResult<T>['metric'] } : {}),
    ...(hit.provider
      ? { provider: hit.provider as VectorSearchResult<T>['provider'] }
      : {}),
  }));
}
