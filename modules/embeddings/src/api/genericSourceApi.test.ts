import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GrpcError,
  VectorIndexStatus,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { EmbeddingsApi } from './embeddingsApi.js';
import {
  GenericSourceApi,
  type EmbeddingDocumentRecord,
  type EmbeddingSourceRecord,
  type GenericSourceApiDeps,
} from './genericSourceApi.js';
import type { Config } from '../config/index.js';
import { CHUNK_VECTOR_FIELD } from '../utils/genericSource.js';

const moduleConfig = {
  enabled: true,
  defaultProvider: 'openai-compatible',
  providers: {
    'openai-compatible': {
      endpoint: 'https://api.openai.com/v1/embeddings',
      apiKey: 'sk-test',
      models: [{ name: 'text-embedding-3-small', dimensions: 3 }],
      defaultModel: 'text-embedding-3-small',
    },
  },
  queue: { concurrency: 1, attempts: 3, maxBatchSize: 50 },
  security: {
    sourceFieldAllowlist: [],
    maxMutationEventIds: 10,
    embedTimeoutMs: 1000,
    maxEmbedInputBytes: 1024,
    maxEmbedResponseBytes: 1024,
    trustedIngestModules: ['database', 'core', 'storage', 'embeddings'],
    maxIngestBatchSize: 4,
    maxChunksPerDocument: 4,
    maxChunkTextBytes: 64,
    maxMetadataBytes: 256,
    maxReferenceBytes: 64,
    sourceSearchMaxLimit: 20,
  },
} as Config;

function matches(doc: object, query: Record<string, unknown>) {
  const record = doc as Record<string, unknown>;
  return Object.entries(query).every(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const ops = value as { $in?: unknown[]; $nin?: unknown[] };
      if (ops.$in) return ops.$in.includes(record[key]);
      if (ops.$nin) return !ops.$nin.includes(record[key]);
    }
    return record[key] === value;
  });
}

function createGeneric(overrides?: {
  embed?: GenericSourceApiDeps['embed'];
  vectorSearch?: GenericSourceApiDeps['vectorSearch'];
  can?: GenericSourceApiDeps['can'];
  createdIndexQueryable?: boolean;
}) {
  const sources: EmbeddingSourceRecord[] = [];
  const documents: EmbeddingDocumentRecord[] = [];
  const chunks: Array<Record<string, unknown>> = [];
  const relations: Array<{ subject: string; relation: string; resource: string }> = [];
  const deletedRelations: Array<{ resource?: string; subject?: string }> = [];
  const lastSearch: Array<Record<string, unknown>> = [];
  const persistedTexts: unknown[] = [];
  const deps: GenericSourceApiDeps = {
    currentConfig: () => moduleConfig,
    sources: {
      findMany: async (query, options) => {
        const matched = sources.filter(source => matches(source, query));
        return matched.slice(
          options?.skip ?? 0,
          (options?.skip ?? 0) + (options?.limit ?? matched.length),
        );
      },
      findOne: async query => sources.find(source => matches(source, query)) ?? null,
      countDocuments: async query =>
        sources.filter(source => matches(source, query)).length,
      create: async doc => {
        const created = {
          _id: `src${sources.length + 1}`,
          ...doc,
        } as EmbeddingSourceRecord;
        sources.push(created);
        return created;
      },
      findByIdAndUpdate: async (id, doc) => {
        const index = sources.findIndex(source => source._id === id);
        if (index < 0) return null;
        sources[index] = { ...sources[index], ...doc };
        return sources[index];
      },
      deleteOne: async query => {
        const index = sources.findIndex(source => matches(source, query));
        if (index >= 0) sources.splice(index, 1);
      },
    },
    documents: {
      findMany: async query => documents.filter(document => matches(document, query)),
      findOne: async query =>
        documents.find(document => matches(document, query)) ?? null,
      countDocuments: async query =>
        documents.filter(document => matches(document, query)).length,
      create: async doc => {
        const created = {
          _id: `doc${documents.length + 1}`,
          ...doc,
        } as EmbeddingDocumentRecord;
        documents.push(created);
        return created;
      },
      findByIdAndUpdate: async (id, doc) => {
        const index = documents.findIndex(document => document._id === id);
        if (index < 0) return null;
        documents[index] = { ...documents[index], ...doc };
        return documents[index];
      },
      deleteOne: async query => {
        const index = documents.findIndex(document => matches(document, query));
        if (index >= 0) documents.splice(index, 1);
      },
      deleteMany: async query => {
        const remaining = documents.filter(document => !matches(document, query));
        const deletedCount = documents.length - remaining.length;
        documents.splice(0, documents.length, ...remaining);
        return { deletedCount };
      },
    },
    chunks: {
      findMany: async (_schema, query) =>
        chunks.filter(chunk => matches(chunk, query)) as never,
      upsertMany: async (_schema, docs) => {
        for (const doc of docs) {
          persistedTexts.push((doc as { text?: unknown }).text);
          const index = chunks.findIndex(
            chunk =>
              chunk.documentId === doc.documentId && chunk.chunkKey === doc.chunkKey,
          );
          if (index >= 0) chunks[index] = { ...chunks[index], ...doc };
          else chunks.push({ _id: `chunk${chunks.length + 1}`, ...doc });
        }
      },
      deleteMany: async (_schema, query) => {
        const remaining = chunks.filter(chunk => !matches(chunk, query));
        const deletedCount = chunks.length - remaining.length;
        chunks.splice(0, chunks.length, ...remaining);
        return { deletedCount };
      },
    },
    chunkSchemas: {
      createSchemaFromAdapter: async () => undefined,
      migrate: async () => undefined,
      getVectorIndexes: async () => [
        {
          field: CHUNK_VECTOR_FIELD,
          name: 'embedding_vector',
          queryable: overrides?.createdIndexQueryable !== false,
          status:
            overrides?.createdIndexQueryable === false
              ? VectorIndexStatus.Pending
              : VectorIndexStatus.Ready,
          dimensions: 3,
          similarity: VectorSimilarity.Cosine,
        },
      ],
      createVectorIndex: async () => 'created',
    },
    getVectorCapabilities: async () => ({
      supported: true,
      storage: true,
      indexing: true,
      search: true,
      provider: 'mongodb',
    }),
    getVectorIndexes: async () => [
      {
        field: CHUNK_VECTOR_FIELD,
        name: 'embedding_vector',
        queryable: true,
        status: VectorIndexStatus.Ready,
        dimensions: 3,
        similarity: VectorSimilarity.Cosine,
      },
    ],
    vectorSearch: async input => {
      lastSearch.push(input);
      return (
        overrides?.vectorSearch?.(input) ??
        Promise.resolve([
          {
            document: {
              sourceId: 'src1',
              documentId: 'doc1',
              chunkKey: 'c1',
              ordinal: 0,
              embedding: [0.1, 0.2, 0.3],
              contentHash: 'hidden',
              partitionSubject: 'Team:org',
              mimeType: 'text/plain',
            },
            score: 0.91,
          },
        ])
      );
    },
    embed: overrides?.embed ?? (async () => [0.1, 0.2, 0.3]),
    can:
      overrides?.can ??
      (async check => ({
        allow:
          check.resource.startsWith('EmbeddingDocument:') ||
          check.resource === 'Team:org',
      })),
    createRelation: async relation => {
      relations.push(relation);
    },
    deleteAllRelations: async query => {
      deletedRelations.push(query);
    },
  };
  return {
    api: new GenericSourceApi(deps),
    embeddings: new EmbeddingsApi({
      currentConfig: () => moduleConfig,
      getSchema: async () => {
        throw new Error('unused');
      },
      declaredSchema: async () => null,
      setSchemaExtension: async () => undefined,
      getVectorCapabilities: async () => ({
        supported: true,
        storage: true,
        indexing: true,
        search: true,
        provider: 'mongodb',
      }),
      getVectorIndexes: async () => [],
      createVectorIndex: async () => 'created',
      deleteVectorIndex: async () => 'deleted',
      invalidateHashes: async () => undefined,
      embed: async () => [0.1, 0.2, 0.3],
      vectorSearch: async () => [],
      configs: {
        findMany: async () => [],
        findOne: async () => null,
        create: async () => ({ _id: 'unused' }) as never,
        findByIdAndUpdate: async () => null,
        deleteOne: async () => undefined,
      },
      backfills: {
        findMany: async () => [],
        findOne: async () => null,
        countDocuments: async () => 0,
        create: async () => ({ _id: 'unused' }),
        findByIdAndUpdate: async () => null,
      },
      getQueueStatus: async () => ({
        generation: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: 0,
        },
        backfill: {
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: 0,
        },
      }),
      enqueueBackfill: async () => undefined,
      generic: deps,
    }),
    sources,
    documents,
    chunks,
    relations,
    deletedRelations,
    lastSearch,
    persistedTexts,
  };
}

async function readySource(api: GenericSourceApi) {
  const created = await api.upsertSource(
    {
      label: 'Notes',
      kind: 'external',
      partitionSubject: 'Team:org',
      metadataAllowlist: ['title'],
    },
    { platformAdmin: true },
  );
  return created.source;
}

describe('generic embedding source API', () => {
  it('creates sources with immutable profile and lists status', async () => {
    const { api, relations } = createGeneric();
    const created = await api.upsertSource(
      {
        label: 'Notes',
        kind: 'external',
        partitionSubject: 'Team:org',
      },
      { callerModule: 'database' },
    );
    assert.equal(created.source.state, 'ready');
    assert.equal(created.source.kind, 'external');
    assert.equal(created.source.model, 'text-embedding-3-small');
    assert.equal(relations[0]?.relation, 'owner');
    await assert.rejects(
      () =>
        api.upsertSource(
          {
            id: created.source.id,
            kind: 'conduit-storage',
            partitionSubject: 'Team:org',
          },
          { platformAdmin: true },
        ),
      (err: unknown) =>
        err instanceof GrpcError && err.code === status.FAILED_PRECONDITION,
    );
    const listed = await api.getSources({ kind: 'external' }, { platformAdmin: true });
    assert.equal(listed.count, 1);
    const statusResult = await api.getSourceStatus(created.source.id, {
      platformAdmin: true,
    });
    assert.equal(statusResult.ready, true);
    assert.equal(statusResult.queuedCount, 0);
    assert.equal(statusResult.extractingCount, 0);
  });

  it('requires container selectors for conduit-storage sources', async () => {
    const { api } = createGeneric();
    await assert.rejects(
      () =>
        api.upsertSource(
          {
            label: 'Files',
            kind: 'conduit-storage',
            partitionSubject: 'Team:org',
            selectors: JSON.stringify({ folderPrefix: 'inbox/' }),
          },
          { platformAdmin: true },
        ),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    const created = await api.upsertSource(
      {
        label: 'Files',
        kind: 'conduit-storage',
        partitionSubject: 'Team:tenant-a',
        selectors: JSON.stringify({
          container: 'docs',
          folderPrefix: 'inbox/',
          mimeTypes: ['text/plain'],
        }),
      },
      { platformAdmin: true },
    );
    assert.equal(created.source.kind, 'conduit-storage');
    assert.equal(created.source.partitionSubject, 'Team:tenant-a');
  });

  it('syncs text or vector chunks without persisting text and skips identical revisions', async () => {
    const { api, chunks, persistedTexts, documents } = createGeneric();
    const source = await readySource(api);
    const first = await api.syncDocument(
      {
        sourceId: source.id,
        externalDocumentId: 'ext-1',
        contentVersion: 'v1',
        metadata: JSON.stringify({ title: 'Note' }),
        chunks: [{ chunkKey: 'c1', ordinal: 0, text: 'hello world' }],
      },
      { callerModule: 'storage' },
    );
    assert.equal(first.status, 'indexed');
    assert.equal(first.replaced, false);
    assert.equal(chunks.length, 1);
    assert.equal(persistedTexts[0], undefined);
    assert.equal('text' in chunks[0], false);
    const skipped = await api.syncDocument(
      {
        sourceId: source.id,
        externalDocumentId: 'ext-1',
        contentVersion: 'v1',
        chunks: [{ chunkKey: 'c1', ordinal: 0, text: 'hello world' }],
      },
      { callerModule: 'storage' },
    );
    assert.equal(skipped.replaced, false);
    assert.equal(skipped.chunks[0].status, 'skipped');
    const replaced = await api.syncDocument(
      {
        sourceId: source.id,
        externalDocumentId: 'ext-1',
        contentVersion: 'v2',
        chunks: [{ chunkKey: 'c2', ordinal: 0, vector: [0.3, 0.2, 0.1] }],
      },
      { callerModule: 'storage' },
    );
    assert.equal(replaced.replaced, true);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].chunkKey, 'c2');
    assert.equal(documents[0].status, 'indexed');
    const deleted = await api.deleteDocument(
      { sourceId: source.id, externalDocumentId: 'ext-1' },
      { callerModule: 'storage' },
    );
    assert.equal(deleted.deletedChunks, 1);
    assert.equal(documents.length, 0);
    assert.equal(chunks.length, 0);
  });

  it('validates a complete replacement before deleting stale chunks and reports partial errors', async () => {
    const { api, chunks } = createGeneric({
      embed: async input => {
        if (input === 'bad') {
          throw new GrpcError(status.UNAVAILABLE, 'provider down');
        }
        return [0.1, 0.2, 0.3];
      },
    });
    const source = await readySource(api);
    await api.syncDocument(
      {
        sourceId: source.id,
        externalDocumentId: 'ext-1',
        contentVersion: 'v1',
        chunks: [
          { chunkKey: 'c1', ordinal: 0, text: 'keep' },
          { chunkKey: 'c2', ordinal: 1, text: 'old' },
        ],
      },
      { callerModule: 'database' },
    );
    const failed = await api.syncDocument(
      {
        sourceId: source.id,
        externalDocumentId: 'ext-1',
        contentVersion: 'v2',
        chunks: [
          { chunkKey: 'c1', ordinal: 0, text: 'keep' },
          { chunkKey: 'c3', ordinal: 1, text: 'bad' },
        ],
      },
      { callerModule: 'database' },
    );
    assert.equal(failed.status, 'failed');
    assert.equal(failed.replaced, false);
    assert.equal(failed.chunks[1].status, 'retry');
    assert.equal(chunks.length, 2);
    assert.deepEqual(chunks.map(chunk => chunk.chunkKey).sort(), ['c1', 'c2']);
    await assert.rejects(
      () =>
        api.syncDocument(
          {
            sourceId: source.id,
            externalDocumentId: 'ext-2',
            chunks: [
              { chunkKey: 'c1', ordinal: 0, text: 'a' },
              { chunkKey: 'c2', ordinal: 1, text: 'b' },
              { chunkKey: 'c3', ordinal: 2, text: 'c' },
              { chunkKey: 'c4', ordinal: 3, text: 'd' },
              { chunkKey: 'c5', ordinal: 4, text: 'e' },
            ],
          },
          { callerModule: 'database' },
        ),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
  });

  it('enforces trusted ingest callers and fail-closed disable/purge', async () => {
    const { api, sources, documents, chunks, deletedRelations } = createGeneric();
    const source = await readySource(api);
    await assert.rejects(
      () =>
        api.syncDocument(
          {
            sourceId: source.id,
            externalDocumentId: 'ext-1',
            chunks: [{ chunkKey: 'c1', ordinal: 0, text: 'hello' }],
          },
          { callerModule: 'chat' },
        ),
      (err: unknown) => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
    await api.syncDocument(
      {
        sourceId: source.id,
        externalDocumentId: 'ext-1',
        chunks: [{ chunkKey: 'c1', ordinal: 0, text: 'hello' }],
      },
      { callerModule: 'storage' },
    );
    await api.disableSource(source.id, { platformAdmin: true });
    await assert.rejects(
      () =>
        api.syncDocument(
          {
            sourceId: source.id,
            externalDocumentId: 'ext-1',
            chunks: [{ chunkKey: 'c1', ordinal: 0, text: 'hello' }],
          },
          { callerModule: 'storage' },
        ),
      (err: unknown) =>
        err instanceof GrpcError && err.code === status.FAILED_PRECONDITION,
    );
    await assert.rejects(
      () =>
        api.search(
          { sourceId: source.id, text: 'hello', userId: 'user-1' },
          { platformAdmin: true },
        ),
      (err: unknown) =>
        err instanceof GrpcError && err.code === status.FAILED_PRECONDITION,
    );
    await api.purgeSource(source.id, { platformAdmin: true });
    assert.equal(sources.length, 0);
    assert.equal(documents.length, 0);
    assert.equal(chunks.length, 0);
    assert.equal(deletedRelations.length > 0, true);
  });

  it('authorizes parent documents, rejects cross-tenant scope, and hides result fields', async () => {
    const { api, lastSearch } = createGeneric({
      can: async check => {
        if (check.resource === 'Team:org') return { allow: true };
        if (check.resource === 'Team:other') return { allow: false };
        if (
          check.resource === 'EmbeddingDocument:doc1' &&
          check.subject === 'User:owner'
        ) {
          return { allow: true };
        }
        return { allow: false };
      },
    });
    const source = await readySource(api);
    await api.syncDocument(
      {
        sourceId: source.id,
        externalDocumentId: 'ext-1',
        metadata: JSON.stringify({ title: 'Note', internal: 'nope' }),
        chunks: [{ chunkKey: 'c1', ordinal: 0, text: 'hello' }],
      },
      { callerModule: 'database' },
    );
    await assert.rejects(
      () =>
        api.search(
          { sourceId: source.id, text: 'hello', userId: 'user-1', scope: 'Team:other' },
          { callerModule: 'router' },
        ),
      (err: unknown) => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
    const teamOnly = await api.search(
      { sourceId: source.id, text: 'hello', userId: 'member', scope: 'Team:org' },
      { callerModule: 'router' },
    );
    assert.equal(teamOnly.hits.length, 0);
    const allowed = await api.search(
      { sourceId: source.id, text: 'hello', userId: 'owner', scope: 'Team:org' },
      { callerModule: 'router' },
    );
    assert.equal(allowed.hits.length, 1);
    const document = JSON.parse(allowed.hits[0].document);
    assert.equal(allowed.hits[0].score, 0.91);
    assert.equal(document.externalDocumentId, 'ext-1');
    assert.equal(document.metadata.title, 'Note');
    assert.equal('embedding' in document, false);
    assert.equal('contentHash' in document, false);
    assert.equal('partitionSubject' in document, false);
    assert.deepEqual(lastSearch[lastSearch.length - 1].filter, {
      sourceId: source.id,
      partitionSubject: 'Team:org',
      status: 'indexed',
    });
    await assert.rejects(
      () =>
        api.search(
          {
            sourceId: source.id,
            queryVector: [0.1, 0.2, 0.3],
            userId: 'owner',
          },
          { callerModule: 'router' },
        ),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    const vectorHits = await api.search(
      {
        sourceId: source.id,
        queryVector: [0.1, 0.2, 0.3],
        userId: 'owner',
      },
      { platformAdmin: true },
    );
    assert.equal(vectorHits.hits.length, 1);
  });

  it('preserves schema search through EmbeddingsApi while routing sourceId', async () => {
    const { embeddings, api } = createGeneric();
    const source = await readySource(api);
    await assert.rejects(
      () =>
        embeddings.semanticSearch(
          { schemaName: 'Article', sourceId: source.id, text: 'hello', userId: 'user-1' },
          { callerModule: 'database' },
        ),
      (err: unknown) => err instanceof GrpcError && err.code === status.INVALID_ARGUMENT,
    );
    await embeddings.semanticSearch(
      { sourceId: source.id, text: 'hello', userId: 'owner', adminOperator: true },
      { platformAdmin: true },
    );
  });
});
