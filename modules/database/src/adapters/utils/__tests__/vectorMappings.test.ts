import { describe, expect, it } from '@jest/globals';
import {
  ConduitSchema,
  TYPE,
  VectorIndexMethod,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { DataTypes } from 'sequelize';
import 'pgvector/sequelize';
import { schemaConverter } from '../../mongoose-adapter/SchemaConverter.js';
import { pgSchemaConverter } from '../../sequelize-adapter/postgres-adapter/PgSchemaConverter.js';
import { sqlSchemaConverter } from '../../sequelize-adapter/sql-adapter/SqlSchemaConverter.js';
import {
  applyMongoVectorField,
  fromMongoVectorIndex,
  fromPostgresVectorIndex,
  mongoVectorStorageType,
  pgVectorDistanceOperator,
  pgVectorOperator,
  postgresIndexMethodSql,
  toMongoVectorIndexDefinition,
  vectorFieldStorageMapping,
} from '../vectorMappings.js';

describe('vector field and index mappings', () => {
  const vectorField = {
    type: TYPE.Vector,
    dimensions: 1536,
    similarity: VectorSimilarity.Cosine,
    select: false,
  };

  it('maps provider-neutral storage contracts', () => {
    expect(vectorFieldStorageMapping('mongodb', vectorField)).toEqual({
      backend: 'mongodb',
      storage: 'numberArray',
      dimensions: 1536,
      searchSupported: true,
    });
    expect(vectorFieldStorageMapping('postgres', vectorField)).toEqual({
      backend: 'postgres',
      storage: 'pgvector',
      dimensions: 1536,
      searchSupported: true,
    });
    expect(vectorFieldStorageMapping('sql', vectorField)).toEqual({
      backend: 'sql',
      storage: 'json',
      dimensions: 1536,
      searchSupported: false,
    });
    expect(mongoVectorStorageType()).toEqual([Number]);
    expect(applyMongoVectorField(vectorField).type).toEqual([Number]);
  });

  it('converts Mongo schema Vector fields to a number array without a live database', () => {
    const converted = schemaConverter(
      new ConduitSchema('Article', {
        title: TYPE.String,
        embedding: vectorField,
      }),
    );
    expect(converted.fields.embedding).toMatchObject({
      type: [Number],
      dimensions: 1536,
      similarity: VectorSimilarity.Cosine,
      select: false,
    });
  });

  it('converts Postgres schema Vector fields to pgvector with dimensions', () => {
    const [converted] = pgSchemaConverter(
      new ConduitSchema('Article', {
        title: { type: TYPE.String },
        embedding: vectorField,
      }),
    );
    const columnType = converted.fields.embedding.type as {
      key?: string;
      _dimensions?: number;
      toSql?: () => string;
    };
    expect(columnType.key).toBe('vector');
    expect(columnType._dimensions).toBe(1536);
    expect(columnType.toSql?.()).toBe('VECTOR(1536)');
  });

  it('converts non-Postgres SQL Vector fields to JSON storage', () => {
    const [converted] = sqlSchemaConverter(
      new ConduitSchema('Article', {
        title: { type: TYPE.String },
        embedding: vectorField,
      }),
    );
    expect(converted.fields.embedding.type).toBe(DataTypes.JSON);
  });

  it('round-trips Mongo vector index definitions', () => {
    const definition = toMongoVectorIndexDefinition({
      name: 'embedding_vector',
      field: 'embedding',
      dimensions: 1536,
      similarity: VectorSimilarity.Cosine,
      method: VectorIndexMethod.HNSW,
      filterFields: ['_id', 'tenantId'],
      options: { quantization: 'scalar', hnsw: { maxEdges: 16 } },
    });
    expect(definition).toEqual({
      fields: [
        {
          type: 'vector',
          path: 'embedding',
          numDimensions: 1536,
          similarity: VectorSimilarity.Cosine,
          quantization: 'scalar',
          indexingMethod: VectorIndexMethod.HNSW,
          hnswOptions: { maxEdges: 16 },
        },
        { type: 'filter', path: '_id' },
        { type: 'filter', path: 'tenantId' },
      ],
    });
    expect(
      fromMongoVectorIndex({
        name: 'embedding_vector',
        latestDefinition: definition,
      }),
    ).toMatchObject({
      name: 'embedding_vector',
      field: 'embedding',
      dimensions: 1536,
      similarity: VectorSimilarity.Cosine,
      method: VectorIndexMethod.HNSW,
      filterFields: ['_id', 'tenantId'],
    });
  });

  it('maps Postgres similarity operators and parses index definitions', () => {
    expect(pgVectorOperator(VectorSimilarity.Cosine)).toBe('vector_cosine_ops');
    expect(pgVectorOperator(VectorSimilarity.Euclidean)).toBe('vector_l2_ops');
    expect(pgVectorOperator(VectorSimilarity.DotProduct)).toBe('vector_ip_ops');
    expect(pgVectorDistanceOperator(VectorSimilarity.Cosine)).toBe('<=>');
    expect(pgVectorDistanceOperator(VectorSimilarity.Euclidean)).toBe('<->');
    expect(pgVectorDistanceOperator(VectorSimilarity.DotProduct)).toBe('<#>');
    expect(postgresIndexMethodSql(VectorIndexMethod.IVFFlat)).toBe('ivfflat');
    expect(postgresIndexMethodSql()).toBe('hnsw');

    const parsed = fromPostgresVectorIndex(
      'cnd_article_embedding_vector',
      'CREATE INDEX cnd_article_embedding_vector ON cnd_article USING hnsw ("embedding" vector_cosine_ops)',
    );
    expect(parsed).toMatchObject({
      name: 'cnd_article_embedding_vector',
      field: 'embedding',
      dimensions: 0,
      similarity: VectorSimilarity.Cosine,
      method: 'hnsw',
    });
    expect(
      fromPostgresVectorIndex(
        'cnd_article_embedding_vector',
        'CREATE INDEX cnd_article_embedding_vector ON cnd_article USING ivfflat (embedding vector_l2_ops)',
        { dimensions: 1536, similarity: VectorSimilarity.Euclidean },
      ),
    ).toMatchObject({
      field: 'embedding',
      dimensions: 1536,
      similarity: VectorSimilarity.Euclidean,
      method: 'ivfflat',
    });
  });
});
