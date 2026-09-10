import {
  GrpcError,
  VectorIndexStatus,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import type { Config } from '../config/index.js';
import {
  EMBEDDING_DOCUMENT_SCHEMA,
  EMBEDDING_SOURCE_SCHEMA,
  CHUNK_VECTOR_FIELD,
  assertVectorProfile,
  ensureProfileChunkSchema,
  modelFingerprint,
  toPersistedChunk,
  type BackingIndexState,
  type ChunkSchemaStore,
  type EmbeddingDocumentState,
  type EmbeddingSourceKind,
  type EmbeddingSourceState,
  type VectorProfile,
} from '../utils/genericSource.js';
import {
  assertBoundedReference,
  assertCanManageSources,
  assertChunkKey,
  assertClientSourceSearchRequest,
  assertExternalDocumentId,
  assertFiniteVector,
  assertImmutableProfile,
  assertIngestBatch,
  assertPartitionSubject,
  assertSourceKind,
  assertSourceSearchable,
  assertSourceWritable,
  assertTrustedIngest,
  assertXorTextOrVector,
  assertBoundedBytes,
  classifyIngestError,
  documentResource,
  hashChunkContent,
  ingestErrorMessage,
  ingestLimits,
  parseBoundedObject,
  resourceRef,
  sanitizeSourceSearchDocument,
  sourceSearchFilter,
  userSubject,
  type IngestChunkInput,
  type IngestItemStatus,
  type PreparedChunk,
} from '../utils/genericIngest.js';
import {
  isEmbeddingVectorIndexQueryable,
  type VectorIndexGate,
} from '../utils/backfillGates.js';
import { clampClientSearchLimit } from '../utils/clientSearchContext.js';
import { parseJsonObject, toIsoString } from '../utils/protoMappers.js';
import {
  assertConfiguredProvider,
  resolveCatalogueDimensions,
  resolveCatalogueModel,
} from '../utils/providerConfig.js';
import {
  assertSemanticSearchAccess,
  resolveAdminOperatorContext,
} from '../utils/schemaPolicy.js';
import { sanitizeErrorMessage } from '../utils/redactConfig.js';

export interface EmbeddingSourceRecord {
  _id: string;
  label?: string;
  kind: EmbeddingSourceKind;
  state: EmbeddingSourceState;
  partitionSubject: string;
  provider: string;
  modelName: string;
  dimensions: number;
  similarity: string;
  selectors?: Record<string, unknown>;
  metadataAllowlist?: string[];
  syncCheckpoint?: Record<string, unknown>;
  chunkSchemaName?: string;
  chunkIndexName?: string;
  chunkIndexStatus?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface EmbeddingDocumentRecord {
  _id: string;
  sourceId: string;
  externalDocumentId: string;
  contentVersion?: string;
  etag?: string;
  metadata?: Record<string, unknown>;
  storageFileId?: string;
  connectorReference?: string;
  mimeType?: string;
  partitionSubject: string;
  status: EmbeddingDocumentState;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface SourceStore {
  findMany: (
    query: Record<string, unknown>,
    options?: { skip?: number; limit?: number },
  ) => Promise<EmbeddingSourceRecord[]>;
  findOne: (query: Record<string, unknown>) => Promise<EmbeddingSourceRecord | null>;
  countDocuments: (query: Record<string, unknown>) => Promise<number>;
  create: (doc: Record<string, unknown>) => Promise<EmbeddingSourceRecord>;
  findByIdAndUpdate: (
    id: string,
    doc: Record<string, unknown>,
  ) => Promise<EmbeddingSourceRecord | null>;
  deleteOne: (query: Record<string, unknown>) => Promise<unknown>;
}

export interface DocumentStore {
  findMany: (query: Record<string, unknown>) => Promise<EmbeddingDocumentRecord[]>;
  findOne: (query: Record<string, unknown>) => Promise<EmbeddingDocumentRecord | null>;
  countDocuments: (query: Record<string, unknown>) => Promise<number>;
  create: (doc: Record<string, unknown>) => Promise<EmbeddingDocumentRecord>;
  findByIdAndUpdate: (
    id: string,
    doc: Record<string, unknown>,
  ) => Promise<EmbeddingDocumentRecord | null>;
  deleteOne: (query: Record<string, unknown>) => Promise<unknown>;
  deleteMany: (
    query: Record<string, unknown>,
  ) => Promise<{ deletedCount?: number } | unknown>;
}

export interface ChunkRecord extends Record<string, unknown> {
  _id?: string;
  documentId: string;
  sourceId: string;
  chunkKey: string;
  ordinal: number;
  embedding?: number[];
  contentHash: string;
  metadata?: Record<string, unknown>;
  mimeType?: string;
  status?: string;
}

export interface GenericChunkStore {
  findMany: (
    schemaName: string,
    query: Record<string, unknown>,
  ) => Promise<ChunkRecord[]>;
  upsertMany: (schemaName: string, docs: Record<string, unknown>[]) => Promise<unknown>;
  deleteMany: (
    schemaName: string,
    query: Record<string, unknown>,
  ) => Promise<{ deletedCount?: number } | unknown>;
}

export interface GenericSourceCaller {
  callerModule?: string;
  platformAdmin?: boolean;
}

export interface GenericSourceApiDeps {
  currentConfig: () => Config;
  sources: SourceStore;
  documents: DocumentStore;
  chunks: GenericChunkStore;
  chunkSchemas: ChunkSchemaStore;
  getVectorCapabilities: (schemaName?: string) => Promise<{
    supported: boolean;
    storage: boolean;
    indexing: boolean;
    search: boolean;
    provider: string;
    reason?: string;
  }>;
  getVectorIndexes: (schemaName: string) => Promise<VectorIndexGate[]>;
  vectorSearch: (input: {
    schemaName: string;
    field: string;
    vector: number[];
    filter?: Record<string, unknown>;
    limit?: number;
    userId?: string;
    scope?: string;
    adminOperator?: boolean;
  }) => Promise<
    Array<{
      document?: Record<string, unknown>;
      score: number;
      distance?: number;
      metric?: string;
      provider?: string;
    }>
  >;
  embed: (input: string, provider: string, model: string) => Promise<number[]>;
  can?: (check: {
    subject: string;
    actions: string[];
    resource: string;
  }) => Promise<{ allow?: boolean }>;
  createRelation?: (relation: {
    subject: string;
    relation: string;
    resource: string;
  }) => Promise<unknown>;
  deleteAllRelations?: (query: {
    resource?: string;
    subject?: string;
  }) => Promise<unknown>;
}

export interface MappedEmbeddingSource {
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
}

const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 100;

export function mapEmbeddingSource(doc: EmbeddingSourceRecord): MappedEmbeddingSource {
  return {
    id: doc._id,
    ...(doc.label ? { label: doc.label } : {}),
    kind: doc.kind,
    state: doc.state,
    partitionSubject: doc.partitionSubject,
    provider: doc.provider,
    model: doc.modelName,
    dimensions: doc.dimensions,
    similarity: doc.similarity,
    ...(doc.selectors ? { selectors: JSON.stringify(doc.selectors) } : {}),
    metadataAllowlist: [...(doc.metadataAllowlist ?? [])],
    ...(doc.syncCheckpoint ? { syncCheckpoint: JSON.stringify(doc.syncCheckpoint) } : {}),
    ...(doc.chunkSchemaName ? { chunkSchemaName: doc.chunkSchemaName } : {}),
    ...(doc.chunkIndexName ? { chunkIndexName: doc.chunkIndexName } : {}),
    ...(doc.chunkIndexStatus ? { chunkIndexStatus: doc.chunkIndexStatus } : {}),
    createdAt: toIsoString(doc.createdAt),
    updatedAt: toIsoString(doc.updatedAt),
  };
}

export class GenericSourceApi {
  constructor(private readonly deps: GenericSourceApiDeps) {}

  async upsertSource(
    request: {
      id?: string;
      label?: string;
      kind: string;
      partitionSubject: string;
      provider?: string;
      model?: string;
      dimensions?: number;
      similarity?: string;
      selectors?: string;
      metadataAllowlist?: string[];
    },
    caller: GenericSourceCaller,
  ): Promise<{ source: MappedEmbeddingSource; warnings: string[] }> {
    assertCanManageSources(caller);
    if (request.id) {
      const existing = await this.requireSource(request.id);
      assertImmutableProfile(
        {
          kind: existing.kind,
          partitionSubject: existing.partitionSubject,
          provider: existing.provider,
          modelName: existing.modelName,
          dimensions: existing.dimensions,
          similarity: existing.similarity as VectorSimilarity,
        },
        {
          kind: request.kind,
          partitionSubject: request.partitionSubject,
          provider: request.provider,
          modelName: request.model,
          dimensions: request.dimensions,
          similarity: request.similarity as VectorSimilarity | undefined,
        },
      );
      return this.updateSource(
        {
          id: request.id,
          label: request.label,
          selectors: request.selectors,
          metadataAllowlist: request.metadataAllowlist,
        },
        caller,
      );
    }
    const kind = assertSourceKind(request.kind);
    const partitionSubject = assertPartitionSubject(request.partitionSubject);
    const profile = this.resolveProfile(request);
    const limits = ingestLimits(this.deps.currentConfig());
    const selectors = parseBoundedObject(
      request.selectors,
      'selectors',
      limits.maxMetadataBytes,
    );
    const metadataAllowlist = (request.metadataAllowlist ?? []).filter(
      field => typeof field === 'string' && field.length > 0,
    );
    const created = await this.deps.sources.create({
      label: request.label,
      kind,
      state: 'pending',
      partitionSubject,
      provider: profile.provider,
      modelName: profile.modelName,
      dimensions: profile.dimensions,
      similarity: profile.similarity,
      selectors,
      metadataAllowlist,
    });
    await this.createOwnedRelation(
      resourceRef(EMBEDDING_SOURCE_SCHEMA, created._id),
      partitionSubject,
    );
    const { source, warnings } = await this.provisionSourceIndex(created);
    return { source: mapEmbeddingSource(source), warnings };
  }

  async updateSource(
    request: {
      id: string;
      label?: string;
      selectors?: string;
      metadataAllowlist?: string[];
      syncCheckpoint?: string;
    },
    caller: GenericSourceCaller,
  ): Promise<{ source: MappedEmbeddingSource; warnings: string[] }> {
    assertCanManageSources(caller);
    const existing = await this.requireSource(request.id);
    const limits = ingestLimits(this.deps.currentConfig());
    const patch: Record<string, unknown> = {};
    if (request.label !== undefined) patch.label = request.label;
    if (request.selectors !== undefined) {
      patch.selectors = parseBoundedObject(
        request.selectors,
        'selectors',
        limits.maxMetadataBytes,
      );
    }
    if (request.metadataAllowlist) {
      patch.metadataAllowlist = request.metadataAllowlist.filter(
        field => typeof field === 'string' && field.length > 0,
      );
    }
    if (request.syncCheckpoint !== undefined) {
      patch.syncCheckpoint = parseBoundedObject(
        request.syncCheckpoint,
        'syncCheckpoint',
        limits.maxMetadataBytes,
      );
    }
    const updated =
      (await this.deps.sources.findByIdAndUpdate(existing._id, patch)) ?? existing;
    return { source: mapEmbeddingSource(updated), warnings: [] };
  }

  async getSources(
    request: {
      kind?: string;
      state?: string;
      partitionSubject?: string;
      skip?: number;
      limit?: number;
    },
    caller: GenericSourceCaller,
  ): Promise<{ sources: MappedEmbeddingSource[]; count: number }> {
    assertCanManageSources(caller);
    const query: Record<string, unknown> = {};
    if (request.kind) query.kind = assertSourceKind(request.kind);
    if (request.state) query.state = request.state;
    if (request.partitionSubject) {
      query.partitionSubject = assertPartitionSubject(request.partitionSubject);
    }
    const skip = Math.max(request.skip ?? 0, 0);
    const limit = Math.min(
      Math.max(request.limit ?? DEFAULT_LIST_LIMIT, 1),
      MAX_LIST_LIMIT,
    );
    const [sources, count] = await Promise.all([
      this.deps.sources.findMany(query, { skip, limit }),
      this.deps.sources.countDocuments(query),
    ]);
    return { sources: sources.map(mapEmbeddingSource), count };
  }

  async getSource(
    id: string,
    caller: GenericSourceCaller,
  ): Promise<MappedEmbeddingSource> {
    assertCanManageSources(caller);
    return mapEmbeddingSource(await this.requireSource(id));
  }

  async getSourceStatus(id: string, caller: GenericSourceCaller) {
    assertCanManageSources(caller);
    const source = await this.requireSource(id);
    const counts = await this.documentStatusCounts(source._id);
    const warnings: string[] = [];
    const ready = source.state === 'ready';
    if (!ready) {
      warnings.push(`Embedding source '${source._id}' is ${source.state}`);
    }
    if (source.chunkIndexStatus && source.chunkIndexStatus !== VectorIndexStatus.Ready) {
      warnings.push(`Chunk index status is ${source.chunkIndexStatus}`);
    }
    return {
      source: mapEmbeddingSource(source),
      ready,
      ...counts,
      warnings,
    };
  }

  async disableSource(
    id: string,
    caller: GenericSourceCaller,
  ): Promise<MappedEmbeddingSource> {
    assertCanManageSources(caller);
    const source = await this.requireSource(id);
    const updated = (await this.deps.sources.findByIdAndUpdate(source._id, {
      state: 'disabled',
    })) ?? {
      ...source,
      state: 'disabled' as const,
    };
    return mapEmbeddingSource(updated);
  }

  async revokeSource(
    id: string,
    caller: GenericSourceCaller,
  ): Promise<MappedEmbeddingSource> {
    assertCanManageSources(caller);
    const source = await this.requireSource(id);
    await this.purgeRelations(source);
    const updated = (await this.deps.sources.findByIdAndUpdate(source._id, {
      state: 'revoked',
    })) ?? {
      ...source,
      state: 'revoked' as const,
    };
    return mapEmbeddingSource(updated);
  }

  async purgeSource(id: string, caller: GenericSourceCaller) {
    assertCanManageSources(caller);
    const source = await this.requireSource(id);
    await this.deps.sources.findByIdAndUpdate(source._id, { state: 'revoked' });
    await this.purgeRelations(source);
    const documents = await this.deps.documents.findMany({ sourceId: source._id });
    const existingChunks = source.chunkSchemaName
      ? await this.deps.chunks.findMany(source.chunkSchemaName, { sourceId: source._id })
      : [];
    if (source.chunkSchemaName) {
      await this.deps.chunks.deleteMany(source.chunkSchemaName, { sourceId: source._id });
    }
    await this.deps.documents.deleteMany({ sourceId: source._id });
    await this.deps.sources.deleteOne({ _id: source._id });
    return {
      source: mapEmbeddingSource({ ...source, state: 'revoked' }),
      deletedDocuments: documents.length,
      deletedChunks: existingChunks.length,
    };
  }

  async syncDocument(
    request: {
      sourceId: string;
      externalDocumentId: string;
      contentVersion?: string;
      etag?: string;
      metadata?: string;
      storageFileId?: string;
      connectorReference?: string;
      mimeType?: string;
      chunks: IngestChunkInput[];
    },
    caller: GenericSourceCaller,
  ) {
    const limits = ingestLimits(this.deps.currentConfig());
    assertTrustedIngest({
      ...caller,
      trustedModules: limits.trustedIngestModules,
    });
    const source = await this.requireSource(request.sourceId);
    assertSourceWritable(source.state);
    if (!source.chunkSchemaName) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        `Embedding source '${source._id}' has no chunk index`,
      );
    }
    const externalDocumentId = assertExternalDocumentId(request.externalDocumentId);
    assertIngestBatch(request.chunks, limits);
    const profile = assertVectorProfile(source);
    const metadata = parseBoundedObject(
      request.metadata,
      'metadata',
      limits.maxMetadataBytes,
    );
    const storageFileId = assertBoundedReference(
      request.storageFileId,
      limits.maxReferenceBytes,
      'storageFileId',
    );
    const connectorReference = assertBoundedReference(
      request.connectorReference,
      limits.maxReferenceBytes,
      'connectorReference',
    );
    const existing = await this.deps.documents.findOne({
      sourceId: source._id,
      externalDocumentId,
    });
    const prepared = await this.prepareChunks(request.chunks, profile, source, limits);
    const failed = prepared.filter(
      chunk => chunk.status === 'failed' || chunk.status === 'retry',
    );
    if (failed.length) {
      return {
        documentId: existing?._id ?? '',
        sourceId: source._id,
        externalDocumentId,
        status: 'failed',
        replaced: false,
        chunks: prepared.map(chunk => ({
          chunkKey: chunk.chunkKey,
          status: chunk.status,
          ...(chunk.error ? { error: chunk.error } : {}),
        })),
      };
    }
    const liveChunks = existing
      ? await this.deps.chunks.findMany(source.chunkSchemaName, {
          sourceId: source._id,
          documentId: existing._id,
        })
      : [];
    if (
      existing &&
      (request.contentVersion ?? '') === (existing.contentVersion ?? '') &&
      sameChunkRevision(liveChunks, prepared)
    ) {
      return {
        documentId: existing._id,
        sourceId: source._id,
        externalDocumentId,
        status: existing.status,
        replaced: false,
        chunks: prepared.map(chunk => ({
          chunkKey: chunk.chunkKey,
          status: 'skipped' as const,
        })),
      };
    }
    const document =
      existing ??
      (await this.deps.documents.create({
        sourceId: source._id,
        externalDocumentId,
        contentVersion: request.contentVersion,
        etag: request.etag,
        metadata,
        storageFileId,
        connectorReference,
        mimeType: request.mimeType,
        partitionSubject: source.partitionSubject,
        status: 'pending',
      }));
    if (!existing) {
      await this.createOwnedRelation(
        documentResource(document._id),
        source.partitionSubject,
      );
    } else {
      await this.deps.documents.findByIdAndUpdate(document._id, {
        contentVersion: request.contentVersion,
        etag: request.etag,
        metadata,
        storageFileId,
        connectorReference,
        mimeType: request.mimeType,
        status: 'pending',
      });
    }
    const persisted = prepared.map(chunk =>
      toPersistedChunk({
        documentId: document._id,
        sourceId: source._id,
        chunkKey: chunk.chunkKey,
        ordinal: chunk.ordinal,
        embedding: chunk.embedding,
        contentHash: chunk.contentHash,
        metadata: chunk.metadata,
        sourceLocator: storageFileId ?? connectorReference,
        partitionSubject: source.partitionSubject,
        modelFingerprint: modelFingerprint(profile),
        mimeType: request.mimeType,
        status: 'indexed',
      }),
    );
    await this.deps.chunks.upsertMany(source.chunkSchemaName, persisted);
    const keepKeys = new Set(prepared.map(chunk => chunk.chunkKey));
    const stale = liveChunks.filter(chunk => !keepKeys.has(chunk.chunkKey));
    if (stale.length) {
      await this.deps.chunks.deleteMany(source.chunkSchemaName, {
        documentId: document._id,
        chunkKey: { $nin: [...keepKeys] },
      });
    }
    await this.deps.documents.findByIdAndUpdate(document._id, { status: 'indexed' });
    return {
      documentId: document._id,
      sourceId: source._id,
      externalDocumentId,
      status: 'indexed',
      replaced: Boolean(existing),
      chunks: prepared.map(chunk => ({
        chunkKey: chunk.chunkKey,
        status: 'indexed' as const,
      })),
    };
  }

  async deleteDocument(
    request: { sourceId: string; externalDocumentId: string },
    caller: GenericSourceCaller,
  ) {
    const limits = ingestLimits(this.deps.currentConfig());
    assertTrustedIngest({
      ...caller,
      trustedModules: limits.trustedIngestModules,
    });
    const source = await this.requireSource(request.sourceId);
    const externalDocumentId = assertExternalDocumentId(request.externalDocumentId);
    const document = await this.deps.documents.findOne({
      sourceId: source._id,
      externalDocumentId,
    });
    if (!document) {
      throw new GrpcError(status.NOT_FOUND, 'Embedding document not found');
    }
    const existingChunks = source.chunkSchemaName
      ? await this.deps.chunks.findMany(source.chunkSchemaName, {
          documentId: document._id,
        })
      : [];
    if (source.chunkSchemaName) {
      await this.deps.chunks.deleteMany(source.chunkSchemaName, {
        documentId: document._id,
      });
    }
    const deletedChunks = existingChunks.length;
    await this.deps.deleteAllRelations?.({ resource: documentResource(document._id) });
    await this.deps.documents.deleteOne({ _id: document._id });
    return { documentId: document._id, deletedChunks };
  }

  async search(
    request: {
      sourceId: string;
      text?: string;
      queryVector?: number[];
      filter?: string;
      limit?: number;
      userId?: string;
      scope?: string;
      adminOperator?: boolean;
    },
    caller: GenericSourceCaller,
  ) {
    const source = await this.requireSource(request.sourceId);
    assertSourceSearchable(source.state);
    if (!source.chunkSchemaName) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        `Embedding source '${source._id}' has no chunk index`,
      );
    }
    assertClientSourceSearchRequest({
      queryVector: request.queryVector,
      adminOperator: request.adminOperator,
      callerModule: caller.callerModule,
    });
    const adminOperator = caller.platformAdmin
      ? true
      : resolveAdminOperatorContext({
          requested: request.adminOperator,
          callerModule: caller.callerModule,
        });
    assertSemanticSearchAccess({
      userId: request.userId,
      scope: request.scope,
      adminOperator,
    });
    if (!adminOperator && !request.userId) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Source search requires an authenticated user to authorize parent documents',
      );
    }
    if (request.scope && request.scope !== source.partitionSubject) {
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Requested scope does not match the source partition',
      );
    }
    if (request.scope && request.userId && !adminOperator) {
      const allowed = await this.deps.can?.({
        subject: userSubject(request.userId),
        actions: ['read'],
        resource: request.scope,
      });
      if (!allowed?.allow) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'Authenticated user cannot read the requested scope',
        );
      }
    }
    const profile = assertVectorProfile(source);
    const text = request.text?.trim() ?? '';
    const hasText = text.length > 0;
    const hasVector = Boolean(request.queryVector?.length);
    if (hasText === hasVector) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Source search requires exactly one of text or queryVector',
      );
    }
    const vector = hasVector
      ? assertFiniteVector(request.queryVector, profile.dimensions, 'queryVector')
      : await this.embedQuery(text, profile);
    const extraFilter = this.parseSourceFilter(request.filter);
    const filter = sourceSearchFilter({
      sourceId: source._id,
      partitionSubject: source.partitionSubject,
      extra: extraFilter,
    });
    const limits = ingestLimits(this.deps.currentConfig());
    const limit =
      caller.platformAdmin || caller.callerModule !== 'router'
        ? Math.min(request.limit ?? 10, limits.sourceSearchMaxLimit)
        : (clampClientSearchLimit(request.limit) ?? 10);
    const [capabilities, indexes] = await Promise.all([
      this.deps.getVectorCapabilities(source.chunkSchemaName),
      this.deps.getVectorIndexes(source.chunkSchemaName),
    ]);
    if (!capabilities.search) {
      throw new GrpcError(status.FAILED_PRECONDITION, 'Vector search is unavailable');
    }
    const index = indexes.find(item => item.field === CHUNK_VECTOR_FIELD);
    if (!isEmbeddingVectorIndexQueryable(index)) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        'Source chunk index is not queryable',
      );
    }
    const results = await this.deps.vectorSearch({
      schemaName: source.chunkSchemaName,
      field: CHUNK_VECTOR_FIELD,
      vector,
      filter,
      limit,
      userId: request.userId,
      scope: request.scope,
      adminOperator,
    });
    const candidateIds = [
      ...new Set(
        results
          .map(result => {
            const documentId = (result.document ?? {}).documentId;
            return typeof documentId === 'string' ? documentId : '';
          })
          .filter(Boolean),
      ),
    ];
    const documents = candidateIds.length
      ? await this.deps.documents.findMany({ _id: { $in: candidateIds } })
      : [];
    const byId = new Map(documents.map(doc => [doc._id, doc]));
    const authorized = new Map<string, boolean>();
    const hits = [];
    for (const result of results) {
      const hit = (result.document ?? {}) as Record<string, unknown>;
      const documentId = typeof hit.documentId === 'string' ? hit.documentId : '';
      if (!documentId) continue;
      const allowed = await this.authorizeDocument({
        documentId,
        userId: request.userId,
        scope: request.scope,
        adminOperator,
        cache: authorized,
      });
      if (!allowed) continue;
      hits.push({
        document: JSON.stringify(
          sanitizeSourceSearchDocument({
            hit,
            document: byId.get(documentId),
            metadataAllowlist: source.metadataAllowlist,
          }),
        ),
        score: result.score,
        ...(result.distance != null ? { distance: result.distance } : {}),
        ...(result.metric ? { metric: result.metric } : {}),
        ...(result.provider ? { provider: result.provider } : {}),
      });
    }
    return { hits };
  }

  private async authorizeDocument(args: {
    documentId: string;
    userId?: string;
    scope?: string;
    adminOperator: boolean;
    cache: Map<string, boolean>;
  }): Promise<boolean> {
    if (args.adminOperator) return true;
    if (args.cache.has(args.documentId)) return args.cache.get(args.documentId)!;
    const resource = documentResource(args.documentId);
    let allow = false;
    if (args.userId) {
      const decision = await this.deps.can?.({
        subject: userSubject(args.userId),
        actions: ['read'],
        resource,
      });
      allow = decision?.allow === true;
    }
    args.cache.set(args.documentId, allow);
    return allow;
  }

  private parseSourceFilter(filter?: string): Record<string, unknown> | undefined {
    try {
      return parseJsonObject(filter, 'filter');
    } catch {
      throw new GrpcError(status.INVALID_ARGUMENT, 'filter must be a JSON object');
    }
  }

  private async embedQuery(text: string, profile: VectorProfile): Promise<number[]> {
    const vector = await this.deps.embed(text, profile.provider, profile.modelName);
    return assertFiniteVector(vector, profile.dimensions, 'query embedding');
  }

  private resolveProfile(request: {
    provider?: string;
    model?: string;
    dimensions?: number;
    similarity?: string;
  }): VectorProfile {
    const config = this.deps.currentConfig();
    const { name: provider, settings } = assertConfiguredProvider(
      config.providers,
      request.provider || config.defaultProvider,
    );
    const model = resolveCatalogueModel(settings, request.model);
    const dimensions = resolveCatalogueDimensions(model, request.dimensions);
    return assertVectorProfile({
      provider,
      modelName: model.name,
      dimensions,
      similarity: request.similarity || VectorSimilarity.Cosine,
    });
  }

  private async requireSource(id: string): Promise<EmbeddingSourceRecord> {
    const source = await this.deps.sources.findOne({ _id: id });
    if (!source) {
      throw new GrpcError(status.NOT_FOUND, `Embedding source '${id}' was not found`);
    }
    return source;
  }

  private async provisionSourceIndex(source: EmbeddingSourceRecord): Promise<{
    source: EmbeddingSourceRecord;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    try {
      const capabilities = await this.deps.getVectorCapabilities();
      const backing: BackingIndexState = await ensureProfileChunkSchema(
        this.deps.chunkSchemas,
        source,
      );
      const indexes = await this.deps.getVectorIndexes(backing.schemaName);
      const queryable = isEmbeddingVectorIndexQueryable(
        indexes.find(index => index.field === CHUNK_VECTOR_FIELD),
      );
      const indexStatus = queryable ? VectorIndexStatus.Ready : VectorIndexStatus.Pending;
      const state: EmbeddingSourceState =
        queryable && capabilities.search
          ? 'ready'
          : capabilities.indexing
            ? 'pending'
            : 'failed';
      if (!queryable) {
        warnings.push('Chunk vector index is not queryable yet');
      }
      if (!capabilities.indexing) {
        warnings.push(
          'Database indexing is unavailable; create the chunk index manually',
        );
      }
      const updated = (await this.deps.sources.findByIdAndUpdate(source._id, {
        chunkSchemaName: backing.schemaName,
        chunkIndexName: backing.indexName,
        chunkIndexStatus: indexStatus,
        state,
      })) ?? { ...source, chunkSchemaName: backing.schemaName, state };
      return { source: updated, warnings };
    } catch (err) {
      const updated = (await this.deps.sources.findByIdAndUpdate(source._id, {
        state: 'failed',
        chunkIndexStatus: VectorIndexStatus.Failed,
      })) ?? { ...source, state: 'failed' as const };
      warnings.push(`Failed to provision chunk index: ${sanitizeErrorMessage(err)}`);
      return { source: updated, warnings };
    }
  }

  private async prepareChunks(
    chunks: IngestChunkInput[],
    profile: VectorProfile,
    source: EmbeddingSourceRecord,
    limits: ReturnType<typeof ingestLimits>,
  ): Promise<Array<PreparedChunk & { error?: string }>> {
    const prepared: Array<PreparedChunk & { error?: string }> = [];
    const seen = new Set<string>();
    for (const [index, chunk] of chunks.entries()) {
      try {
        const chunkKey = assertChunkKey(chunk.chunkKey);
        if (seen.has(chunkKey)) {
          throw new GrpcError(
            status.INVALID_ARGUMENT,
            `Duplicate chunkKey '${chunkKey}'`,
          );
        }
        seen.add(chunkKey);
        if (!Number.isInteger(chunk.ordinal) || (chunk.ordinal ?? 0) < 0) {
          throw new GrpcError(
            status.INVALID_ARGUMENT,
            'ordinal must be a non-negative integer',
          );
        }
        const xor = assertXorTextOrVector(chunk);
        const metadata = parseBoundedObject(
          chunk.metadata,
          `chunks[${index}].metadata`,
          limits.maxMetadataBytes,
        );
        let embedding: number[];
        let contentHash: string;
        if (xor.text != null) {
          assertBoundedBytes(xor.text, limits.maxChunkTextBytes, 'text');
          embedding = assertFiniteVector(
            await this.deps.embed(xor.text, source.provider, source.modelName),
            profile.dimensions,
            'embedding',
          );
          contentHash = hashChunkContent(profile, xor.text);
        } else {
          embedding = assertFiniteVector(xor.vector, profile.dimensions);
          contentHash = hashChunkContent(profile, embedding);
        }
        prepared.push({
          chunkKey,
          ordinal: chunk.ordinal as number,
          embedding,
          contentHash,
          metadata,
          status: 'indexed',
        });
      } catch (err) {
        prepared.push({
          chunkKey: chunk.chunkKey || `chunk-${index}`,
          ordinal: chunk.ordinal ?? index,
          embedding: [],
          contentHash: '',
          status: classifyIngestError(err),
          error: ingestErrorMessage(err),
        });
      }
    }
    return prepared;
  }

  private async documentStatusCounts(sourceId: string) {
    const documents = await this.deps.documents.findMany({ sourceId });
    const counts = {
      pendingCount: 0,
      indexedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      staleCount: 0,
      deletedCount: 0,
    };
    for (const document of documents) {
      switch (document.status) {
        case 'pending':
          counts.pendingCount += 1;
          break;
        case 'indexed':
          counts.indexedCount += 1;
          break;
        case 'skipped':
          counts.skippedCount += 1;
          break;
        case 'failed':
          counts.failedCount += 1;
          break;
        case 'stale':
          counts.staleCount += 1;
          break;
        case 'deleted':
          counts.deletedCount += 1;
          break;
        default: {
          const _never: never = document.status;
          void _never;
        }
      }
    }
    return counts;
  }

  private async createOwnedRelation(resource: string, subject: string) {
    await this.deps.createRelation?.({ subject, relation: 'owner', resource });
  }

  private async purgeRelations(source: EmbeddingSourceRecord) {
    const documents = await this.deps.documents.findMany({ sourceId: source._id });
    for (const document of documents) {
      await this.deps.deleteAllRelations?.({ resource: documentResource(document._id) });
    }
    await this.deps.deleteAllRelations?.({
      resource: resourceRef(EMBEDDING_SOURCE_SCHEMA, source._id),
    });
  }
}

function sameChunkRevision(existing: ChunkRecord[], next: PreparedChunk[]): boolean {
  if (existing.length !== next.length) return false;
  const hashes = new Map(existing.map(chunk => [chunk.chunkKey, chunk.contentHash]));
  return next.every(chunk => hashes.get(chunk.chunkKey) === chunk.contentHash);
}
