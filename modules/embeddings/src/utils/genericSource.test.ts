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
  chunkSchemaPostgresRelations,
  chunkVectorIndexDefinition,
  conduitPhysicalCollectionName,
  CHUNK_FILTER_FIELDS,
  CHUNK_SCHEMA_HASH_LENGTH,
  CHUNK_VECTOR_FIELD,
  EMBEDDING_CHUNK_SCHEMA_PREFIX,
  EMBEDDING_DOCUMENT_SCHEMA,
  EMBEDDING_SOURCE_SCHEMA,
  ensureProfileChunkSchema,
  isEmbeddingChunkSchema,
  LEGACY_EMBEDDING_CHUNK_SCHEMA_PREFIX,
  legacyChunkSchemaNameForProfile,
  modelFingerprint,
  POSTGRES_NAMEDATALEN,
  postgresIdentifier,
  postgresQuotedIdentifier,
  reconcileSourceChunkSchemas,
  resolveChunkSchemaName,
  sequelizeUnderscore,
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
    filterFields?: readonly string[];
  }>;
} {
  const schemas: ConduitSchema[] = [];
  const indexes: Array<{
    schemaName: string;
    field?: string;
    name?: string;
    dimensions?: number;
    similarity?: string;
    filterFields?: readonly string[];
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
        filterFields: index.filterFields,
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
    assert.equal(small.name.startsWith(LEGACY_EMBEDDING_CHUNK_SCHEMA_PREFIX), false);
    assert.equal(small.name.includes('-'), false);
    assert.equal(small.name.includes(' '), false);
    assert.equal(
      small.name.length,
      EMBEDDING_CHUNK_SCHEMA_PREFIX.length + CHUNK_SCHEMA_HASH_LENGTH,
    );
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

  it('recreates a profile index when live filter fields are incomplete', async () => {
    const store = memoryStore();
    store.indexes.push({
      schemaName: chunkSchemaNameForProfile(smallProfile),
      field: CHUNK_VECTOR_FIELD,
      name: 'embedding_vector',
      dimensions: 1536,
      similarity: VectorSimilarity.Cosine,
      filterFields: ['sourceId'],
    });
    const state = await ensureProfileChunkSchema(store, smallProfile);
    assert.equal(state.created, true);
    assert.equal(state.indexName, 'embedding_vector_v2');
    assert.equal(
      store.indexes.filter(index => index.schemaName === state.schemaName).length,
      2,
    );
  });

  it('reuses a persisted legacy chunk schema instead of renaming a live index', async () => {
    const store = memoryStore();
    const legacy = legacyChunkSchemaNameForProfile(smallProfile);
    const state = await ensureProfileChunkSchema(store, smallProfile, legacy);
    assert.equal(state.schemaName, legacy);
    assert.equal(isEmbeddingChunkSchema(legacy), true);
    assert.equal(resolveChunkSchemaName(smallProfile, legacy), legacy);
    assert.equal(
      resolveChunkSchemaName(smallProfile),
      chunkSchemaNameForProfile(smallProfile),
    );
    assert.notEqual(legacy, chunkSchemaNameForProfile(smallProfile));
  });

  it('keeps PostgreSQL table, index, and constraint names unique under NAMEDATALEN', () => {
    const compact = chunkSchemaNameForProfile(smallProfile);
    const other = chunkSchemaNameForProfile(largeProfile);
    const compactRelations = chunkSchemaPostgresRelations(compact);
    const folded = compactRelations.map(postgresIdentifier);
    const quoted = compactRelations.map(postgresQuotedIdentifier);
    const underscored = compactRelations.map(name =>
      postgresIdentifier(sequelizeUnderscore(name)),
    );
    assert.equal(new Set(folded).size, folded.length);
    assert.equal(new Set(quoted).size, quoted.length);
    assert.equal(new Set(underscored).size, underscored.length);
    assert.equal(
      folded.every(name => Buffer.byteLength(name) <= POSTGRES_NAMEDATALEN),
      true,
    );
    assert.equal(
      quoted.every(name => Buffer.byteLength(name) <= POSTGRES_NAMEDATALEN),
      true,
    );
    assert.equal(
      folded.includes(postgresIdentifier(conduitPhysicalCollectionName(other))),
      false,
    );

    const legacyTable = conduitPhysicalCollectionName(
      legacyChunkSchemaNameForProfile(smallProfile),
    );
    const legacyUnique = postgresQuotedIdentifier(
      sequelizeUnderscore(`${legacyTable}_documentId_chunkKey`),
    );
    const legacyFilter = postgresQuotedIdentifier(
      sequelizeUnderscore(`${legacyTable}_partitionSubject_sourceId`),
    );
    assert.equal(legacyUnique, legacyFilter);
    assert.equal(legacyUnique.length, POSTGRES_NAMEDATALEN);
    assert.match(legacyUnique, /^cnd__embedding_chunk_[0-9a-f]+$/);
    assert.match(postgresIdentifier(legacyTable), /^cnd_embeddingchunk_[0-9a-f]+$/);

    const smokeTable =
      'cnd_EmbeddingChunk_7d18b7e8df76a6ba3a85f32a6e31c602b8dfae5045' +
      'cafebabecafebabecafeba';
    assert.equal(
      postgresQuotedIdentifier(sequelizeUnderscore(`${smokeTable}_documentId_chunkKey`)),
      'cnd__embedding_chunk_7d18b7e8df76a6ba3a85f32a6e31c602b8dfae5045',
    );
    assert.equal(
      postgresQuotedIdentifier(
        sequelizeUnderscore(`${smokeTable}_partitionSubject_sourceId`),
      ),
      postgresQuotedIdentifier(sequelizeUnderscore(`${smokeTable}_documentId_chunkKey`)),
    );
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
