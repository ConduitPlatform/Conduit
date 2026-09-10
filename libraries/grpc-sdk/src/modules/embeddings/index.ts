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
  provider?: string;
  model?: string;
  dimensions?: number;
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
  storageQueue?: QueueCounts;
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
  schemaName?: string;
  sourceId?: string;
  text?: string;
  queryVector?: number[];
  targetField?: string;
  filter?: Indexable;
  limit?: number;
  userId?: string;
  scope?: string;
  adminOperator?: boolean;
}

export interface EmbeddingSourceInput {
  id?: string;
  label?: string;
  kind: string;
  partitionSubject: string;
  provider?: string;
  model?: string;
  dimensions?: number;
  similarity?: string;
  selectors?: Indexable;
  metadataAllowlist?: string[];
}

export interface EmbeddingSourceRecord {
  id: string;
  label?: string;
  kind: string;
  state: string;
  partitionSubject: string;
  provider: string;
  model: string;
  dimensions: number;
  similarity: string;
  selectors?: Indexable;
  metadataAllowlist: string[];
  syncCheckpoint?: Indexable;
  chunkSchemaName?: string;
  chunkIndexName?: string;
  chunkIndexStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface IngestChunkInput {
  chunkKey: string;
  ordinal: number;
  text?: string;
  vector?: number[];
  metadata?: Indexable;
}

export interface SyncDocumentInput {
  sourceId: string;
  externalDocumentId: string;
  contentVersion?: string;
  etag?: string;
  metadata?: Indexable;
  storageFileId?: string;
  connectorReference?: string;
  mimeType?: string;
  container?: string;
  folder?: string;
  chunks: IngestChunkInput[];
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

function mapEmbeddingSource(source: {
  id: string;
  label?: string;
  kind: string;
  state: string;
  partitionSubject: string;
  provider: string;
  model: string;
  dimensions: number;
  similarity: string;
  selectors?: string;
  metadataAllowlist: string[];
  syncCheckpoint?: string;
  chunkSchemaName?: string;
  chunkIndexName?: string;
  chunkIndexStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}): EmbeddingSourceRecord {
  return {
    ...source,
    selectors: parseOptionalJson(source.selectors),
    syncCheckpoint: parseOptionalJson(source.syncCheckpoint),
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
      storageQueue: res.storageQueue,
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
      sourceId: input.sourceId,
      text: input.text,
      queryVector: input.queryVector,
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

  upsertSource(
    input: EmbeddingSourceInput,
  ): Promise<{ source: EmbeddingSourceRecord; warnings: string[] }> {
    return this.client!.upsertSource({
      id: input.id,
      label: input.label,
      kind: input.kind,
      partitionSubject: input.partitionSubject,
      provider: input.provider,
      model: input.model,
      dimensions: input.dimensions,
      similarity: input.similarity,
      selectors: input.selectors ? JSON.stringify(input.selectors) : undefined,
      metadataAllowlist: input.metadataAllowlist,
    }).then(res => ({
      source: mapEmbeddingSource(res.source!),
      warnings: res.warnings,
    }));
  }

  updateSource(input: {
    id: string;
    label?: string;
    selectors?: Indexable;
    metadataAllowlist?: string[];
    syncCheckpoint?: Indexable;
  }): Promise<{ source: EmbeddingSourceRecord; warnings: string[] }> {
    return this.client!.updateSource({
      id: input.id,
      label: input.label,
      selectors: input.selectors ? JSON.stringify(input.selectors) : undefined,
      metadataAllowlist: input.metadataAllowlist,
      syncCheckpoint: input.syncCheckpoint
        ? JSON.stringify(input.syncCheckpoint)
        : undefined,
    }).then(res => ({
      source: mapEmbeddingSource(res.source!),
      warnings: res.warnings,
    }));
  }

  getSources(query?: {
    kind?: string;
    state?: string;
    partitionSubject?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ sources: EmbeddingSourceRecord[]; count: number }> {
    return this.client!.getSources(query ?? {}).then(res => ({
      sources: res.sources.map(mapEmbeddingSource),
      count: res.count,
    }));
  }

  getSource(id: string): Promise<EmbeddingSourceRecord> {
    return this.client!.getSource({ id }).then(mapEmbeddingSource);
  }

  getSourceStatus(id: string): Promise<{
    source: EmbeddingSourceRecord;
    ready: boolean;
    pendingCount: number;
    queuedCount?: number;
    extractingCount?: number;
    indexedCount: number;
    skippedCount: number;
    failedCount: number;
    staleCount: number;
    deletedCount: number;
    extractionQueue?: QueueCounts;
    warnings: string[];
  }> {
    return this.client!.getSourceStatus({ id }).then(res => ({
      source: mapEmbeddingSource(res.source!),
      ready: res.ready,
      pendingCount: res.pendingCount,
      queuedCount: res.queuedCount,
      extractingCount: res.extractingCount,
      indexedCount: res.indexedCount,
      skippedCount: res.skippedCount,
      failedCount: res.failedCount,
      staleCount: res.staleCount,
      deletedCount: res.deletedCount,
      extractionQueue: res.extractionQueue,
      warnings: res.warnings,
    }));
  }

  disableSource(id: string): Promise<EmbeddingSourceRecord> {
    return this.client!.disableSource({ id }).then(mapEmbeddingSource);
  }

  revokeSource(id: string): Promise<EmbeddingSourceRecord> {
    return this.client!.revokeSource({ id }).then(mapEmbeddingSource);
  }

  purgeSource(id: string): Promise<{
    source: EmbeddingSourceRecord;
    deletedDocuments: number;
    deletedChunks: number;
  }> {
    return this.client!.purgeSource({ id }).then(res => ({
      source: mapEmbeddingSource(res.source!),
      deletedDocuments: res.deletedDocuments,
      deletedChunks: res.deletedChunks,
    }));
  }

  syncDocument(input: SyncDocumentInput): Promise<{
    documentId: string;
    sourceId: string;
    externalDocumentId: string;
    status: string;
    replaced: boolean;
    chunks: Array<{ chunkKey: string; status: string; error?: string }>;
  }> {
    return this.client!.syncDocument({
      sourceId: input.sourceId,
      externalDocumentId: input.externalDocumentId,
      contentVersion: input.contentVersion,
      etag: input.etag,
      metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      storageFileId: input.storageFileId,
      connectorReference: input.connectorReference,
      mimeType: input.mimeType,
      container: input.container,
      folder: input.folder,
      chunks: input.chunks.map(chunk => ({
        chunkKey: chunk.chunkKey,
        ordinal: chunk.ordinal,
        text: chunk.text,
        vector: chunk.vector,
        metadata: chunk.metadata ? JSON.stringify(chunk.metadata) : undefined,
      })),
    });
  }

  deleteDocument(input: {
    sourceId: string;
    externalDocumentId: string;
  }): Promise<{ documentId: string; deletedChunks: number }> {
    return this.client!.deleteDocument(input);
  }

  reconcileSource(id: string): Promise<{
    queued: number;
    scanned: number;
    warnings: string[];
  }> {
    return this.client!.reconcileSource({ id });
  }
}
