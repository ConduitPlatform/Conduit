import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ConduitSchema,
  VectorIndexMethod,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { embeddingDocumentFields } from '../models/EmbeddingDocument.schema.js';
import { embeddingSourceFields } from '../models/EmbeddingSource.schema.js';
import {
  assertNoCredentialFields,
  assertNoPersistedTextFields,
  buildChunkBackingSchema,
  chunkSchemaNameForProfile,
  chunkVectorIndexDefinition,
  CHUNK_FILTER_FIELDS,
  CHUNK_VECTOR_FIELD,
  EMBEDDING_CHUNK_SCHEMA_PREFIX,
  EMBEDDING_DOCUMENT_SCHEMA,
  EMBEDDING_SOURCE_SCHEMA,
  ensureProfileChunkSchema,
  isEmbeddingChunkSchema,
  modelFingerprint,
  reconcileSourceChunkSchemas,
  toPersistedChunk,
  type ChunkSchemaStore,
  type VectorProfile,
} from './genericSource.js';
import { isDeniedEmbeddingSchema } from './schemaPolicy.js';

const smallProfile: VectorProfile = {
  provider: 'openai-compatible',
  modelName: 'text-embedding-3-small',
  dimensions: 1536,
  similarity: VectorSimilarity.Cosine,
};

const largeProfile: VectorProfile = {
  ...smallProfile,
  modelName: 'text-embedding-3-large',
  dimensions: 3072,
};

function memoryStore(): ChunkSchemaStore & {
  schemas: ConduitSchema[];
  indexes: Array<{
    schemaName: string;
    field?: string;
    name?: string;
    dimensions?: number;
    similarity?: string;
  }>;
} {
  const schemas: ConduitSchema[] = [];
  const indexes: Array<{
    schemaName: string;
    field?: string;
    name?: string;
    dimensions?: number;
    similarity?: string;
  }> = [];
  return {
    schemas,
    indexes,
    createSchemaFromAdapter: async schema => {
      schemas.push(schema);
    },
    migrate: async () => undefined,
    getVectorIndexes: async schemaName =>
      indexes.filter(index => index.schemaName === schemaName),
    createVectorIndex: async (schemaName, index) => {
      indexes.push({
        schemaName,
        field: index.field,
        name: index.name,
        dimensions: index.dimensions,
        similarity: index.similarity,
      });
    },
  };
}

describe('generic embedding source contracts', () => {
  it('keeps source and document models free of text and credentials', () => {
    assert.doesNotThrow(() =>
      assertNoPersistedTextFields(embeddingSourceFields, 'EmbeddingSource'),
    );
    assert.doesNotThrow(() =>
      assertNoCredentialFields(embeddingSourceFields, 'EmbeddingSource'),
    );
    assert.doesNotThrow(() =>
      assertNoPersistedTextFields(embeddingDocumentFields, 'EmbeddingDocument'),
    );
    assert.doesNotThrow(() =>
      assertNoCredentialFields(embeddingDocumentFields, 'EmbeddingDocument'),
    );
    assert.equal('schemaName' in embeddingSourceFields, false);
    assert.equal('sourceFields' in embeddingSourceFields, false);
    assert.equal('targetField' in embeddingSourceFields, false);
    assert.equal('text' in embeddingDocumentFields, false);
    assert.equal('storageFileId' in embeddingDocumentFields, true);
    assert.equal('connectorReference' in embeddingDocumentFields, true);
    assert.equal('externalDocumentId' in embeddingDocumentFields, true);
    assert.equal('partitionSubject' in embeddingSourceFields, true);
  });

  it('pools hidden chunk schemas by immutable vector profile', () => {
    const small = buildChunkBackingSchema(smallProfile);
    const smallAgain = buildChunkBackingSchema(smallProfile);
    const large = buildChunkBackingSchema(largeProfile);
    assert.equal(small.name, smallAgain.name);
    assert.notEqual(small.name, large.name);
    assert.equal(isEmbeddingChunkSchema(small.name), true);
    assert.equal(small.name.startsWith(EMBEDDING_CHUNK_SCHEMA_PREFIX), true);
    assert.equal(small.name.includes('-'), false);
    assert.equal(small.name.includes(' '), false);
    assert.equal(small.modelOptions.conduit?.cms?.enabled, false);
    assert.equal(small.modelOptions.conduit?.authorization?.enabled, false);
    assert.equal(
      (small.fields[CHUNK_VECTOR_FIELD] as { dimensions: number }).dimensions,
      1536,
    );
    assert.equal(
      (large.fields[CHUNK_VECTOR_FIELD] as { dimensions: number }).dimensions,
      3072,
    );
    assert.equal('text' in small.fields, false);
    assert.equal('content' in small.fields, false);
    assert.equal('excerpt' in small.fields, false);
    assert.deepEqual(chunkVectorIndexDefinition(smallProfile).filterFields, [
      ...CHUNK_FILTER_FIELDS,
    ]);
    assert.equal(chunkSchemaNameForProfile(smallProfile), small.name);
    assert.notEqual(modelFingerprint(smallProfile), modelFingerprint(largeProfile));
  });

  it('does not persist submitted or extracted text on chunk writes', () => {
    const persisted = toPersistedChunk({
      documentId: 'doc-1',
      sourceId: 'source-1',
      chunkKey: 'p0',
      ordinal: 0,
      embedding: [0.1, 0.2],
      contentHash: 'abc',
      partitionSubject: 'Team:acme',
      modelFingerprint: modelFingerprint(smallProfile),
      text: 'should not store',
      content: 'extracted body',
      excerpt: 'snippet',
      body: 'nope',
    });
    assert.equal('text' in persisted, false);
    assert.equal('content' in persisted, false);
    assert.equal('excerpt' in persisted, false);
    assert.equal('body' in persisted, false);
    assert.equal(persisted.documentId, 'doc-1');
    assert.equal(persisted.chunkKey, 'p0');
    assert.equal(Array.isArray(persisted.embedding), true);
  });

  it('provisions one vector index per profile and reuses it', async () => {
    const store = memoryStore();
    const first = await ensureProfileChunkSchema(store, smallProfile);
    const second = await ensureProfileChunkSchema(store, smallProfile);
    const other = await ensureProfileChunkSchema(store, largeProfile);
    assert.equal(first.schemaName, second.schemaName);
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.notEqual(first.schemaName, other.schemaName);
    assert.equal(
      store.schemas.filter(schema => schema.name === first.schemaName).length,
      2,
    );
    assert.equal(
      store.indexes.filter(index => index.schemaName === first.schemaName).length,
      1,
    );
    assert.equal(
      store.indexes.filter(index => index.schemaName === other.schemaName).length,
      1,
    );
    assert.equal(store.indexes[0].field, CHUNK_VECTOR_FIELD);
    assert.equal(store.indexes[0].dimensions, 1536);
    assert.equal(store.indexes[1].dimensions, 3072);
    assert.equal(store.indexes[0].similarity, VectorSimilarity.Cosine);
    assert.equal(store.indexes[0].name, 'embedding_vector');
    assert.equal(chunkVectorIndexDefinition(smallProfile).method, VectorIndexMethod.HNSW);
  });

  it('reconciles existing sources onto profile-isolated backing indexes', async () => {
    const store = memoryStore();
    const persisted: Array<{ id: string; schemaName: string }> = [];
    const states = await reconcileSourceChunkSchemas(
      [
        {
          _id: 'src-a',
          ...smallProfile,
        },
        {
          _id: 'src-b',
          ...smallProfile,
        },
        {
          _id: 'src-c',
          ...largeProfile,
        },
      ],
      store,
      async (id, state) => {
        persisted.push({ id, schemaName: state.schemaName });
      },
    );
    assert.equal(states[0].schemaName, states[1].schemaName);
    assert.notEqual(states[0].schemaName, states[2].schemaName);
    assert.deepEqual(
      persisted.map(item => item.id),
      ['src-a', 'src-b', 'src-c'],
    );
  });

  it('denies generic embeddings schemas as schema-field embedding targets', () => {
    assert.equal(isDeniedEmbeddingSchema({ name: EMBEDDING_SOURCE_SCHEMA }), true);
    assert.equal(isDeniedEmbeddingSchema({ name: EMBEDDING_DOCUMENT_SCHEMA }), true);
    assert.equal(
      isDeniedEmbeddingSchema({ name: chunkSchemaNameForProfile(smallProfile) }),
      true,
    );
    assert.equal(isDeniedEmbeddingSchema({ name: 'Article' }), false);
  });
});
