import { ConduitModule } from '../../classes/index.js';
import { EmbeddingsProviderDefinition } from '../../protoUtils/embeddings.js';
import type {
  Indexable,
  VectorCapabilities,
  VectorSearchResult,
} from '../../interfaces/index.js';

export interface EmbeddingConfigInput {
  schemaName: string;
  sourceFields: string[];
  targetField: string;
  provider: string;
  model: string;
  dimensions: number;
  similarity?: string;
  sourceFieldAllowlist?: string[];
  enabled?: boolean;
}

export interface EmbeddingConfigRecord {
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

export interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface EmbeddingsStatus {
  enabled: boolean;
  ready: boolean;
  capabilities: VectorCapabilities;
  generationQueue: QueueCounts;
  backfillQueue: QueueCounts;
  warnings: string[];
}

export interface BackfillRunRecord {
  id: string;
  schemaName: string;
  configId?: string;
  state: string;
  cursor?: string;
  batchSize: number;
  onlyMissing: boolean;
  filter?: Indexable;
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

export interface StartBackfillInput {
  schemaName: string;
  batchSize?: number;
  configId?: string;
  onlyMissing?: boolean;
  filter?: Indexable;
}

export interface SemanticSearchInput {
  schemaName: string;
  text: string;
  targetField?: string;
  filter?: Indexable;
  limit?: number;
  userId?: string;
  scope?: string;
  adminOperator?: boolean;
}

function parseOptionalJson(value?: string): Indexable | undefined {
  if (!value) return undefined;
  return JSON.parse(value) as Indexable;
}

function mapBackfillRun(run: {
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
}): BackfillRunRecord {
  return {
    ...run,
    filter: parseOptionalJson(run.filter),
  };
}

function mapCapabilities(capabilities: {
  supported: boolean;
  storage: boolean;
  indexing: boolean;
  search: boolean;
  provider: string;
  reason?: string;
}): VectorCapabilities {
  return {
    supported: capabilities.supported,
    storage: capabilities.storage,
    indexing: capabilities.indexing,
    search: capabilities.search,
    provider: capabilities.provider as VectorCapabilities['provider'],
    reason: capabilities.reason,
  };
}

export class EmbeddingsProvider extends ConduitModule<
  typeof EmbeddingsProviderDefinition
> {
  constructor(
    private readonly moduleName: string,
    url: string,
    grpcToken?: string,
  ) {
    super(moduleName, 'embeddings', url, grpcToken);
    this.initializeClient(EmbeddingsProviderDefinition);
  }

  upsertConfig(
    config: EmbeddingConfigInput,
  ): Promise<{ config: EmbeddingConfigRecord; warnings: string[] }> {
    return this.client!.upsertConfig(config).then(res => ({
      config: res.config!,
      warnings: res.warnings,
    }));
  }

  getConfigs(query?: {
    schemaName?: string;
    id?: string;
  }): Promise<EmbeddingConfigRecord[]> {
    return this.client!.getConfigs(query ?? {}).then(res => res.configs);
  }

  deleteConfig(query: {
    id?: string;
    schemaName?: string;
    targetField?: string;
  }): Promise<EmbeddingConfigRecord> {
    return this.client!.deleteConfig(query).then(res => res.config!);
  }

  getCapabilities(schemaName?: string): Promise<{
    capabilities: VectorCapabilities;
    warnings: string[];
  }> {
    return this.client!.getCapabilities({ schemaName }).then(res => ({
      capabilities: mapCapabilities(res.capabilities!),
      warnings: res.warnings,
    }));
  }

  getStatus(schemaName?: string): Promise<EmbeddingsStatus> {
    return this.client!.getStatus({ schemaName }).then(res => ({
      enabled: res.enabled,
      ready: res.ready,
      capabilities: mapCapabilities(res.capabilities!),
      generationQueue: res.generationQueue!,
      backfillQueue: res.backfillQueue!,
      warnings: res.warnings,
    }));
  }

  startBackfill(input: StartBackfillInput): Promise<{
    queued: number;
    runs: BackfillRunRecord[];
    warnings: string[];
  }> {
    return this.client!.startBackfill({
      schemaName: input.schemaName,
      batchSize: input.batchSize,
      configId: input.configId,
      onlyMissing: input.onlyMissing,
      filter: input.filter ? JSON.stringify(input.filter) : undefined,
    }).then(res => ({
      queued: res.queued,
      runs: res.runs.map(mapBackfillRun),
      warnings: res.warnings,
    }));
  }

  getBackfill(id: string): Promise<BackfillRunRecord> {
    return this.client!.getBackfill({ id }).then(mapBackfillRun);
  }

  listBackfills(query?: {
    schemaName?: string;
    state?: string;
    configId?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ runs: BackfillRunRecord[]; count: number }> {
    return this.client!.listBackfills(query ?? {}).then(res => ({
      runs: res.runs.map(mapBackfillRun),
      count: res.count,
    }));
  }

  cancelBackfill(id: string): Promise<BackfillRunRecord> {
    return this.client!.cancelBackfill({ id }).then(res => mapBackfillRun(res.run!));
  }

  resumeBackfill(id: string): Promise<BackfillRunRecord> {
    return this.client!.resumeBackfill({ id }).then(res => mapBackfillRun(res.run!));
  }

  semanticSearch<T = Indexable>(
    input: SemanticSearchInput,
  ): Promise<VectorSearchResult<T>[]> {
    return this.client!.semanticSearch({
      schemaName: input.schemaName,
      text: input.text,
      targetField: input.targetField,
      filter: input.filter ? JSON.stringify(input.filter) : undefined,
      limit: input.limit,
      userId: input.userId,
      scope: input.scope,
      adminOperator: input.adminOperator,
    }).then(res =>
      res.hits.map(hit => ({
        document: JSON.parse(hit.document) as T,
        score: hit.score,
        distance: hit.distance,
        metric: hit.metric as VectorSearchResult<T>['metric'],
        provider: hit.provider as VectorSearchResult<T>['provider'],
      })),
    );
  }
}
