import { describe, expect, it } from '@jest/globals';
import {
  GrpcError,
  TYPE,
  VectorIndexMethod,
  VectorIndexStatus,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  assertPostgresVectorIndexDropTarget,
  assertVectorIndexQueryable,
  bindVectorIndexToField,
  defaultVectorIndexName,
  hydratePostgresVectorIndex,
  mongoSearchIndexReadiness,
  mongoVectorFilterFields,
  planMongoVectorIndexCreate,
  planPostgresVectorIndexCreate,
  postgresVectorIndexDefinitionMatches,
  renderPostgresCreateVectorIndexSql,
} from '../vectorIndexLifecycle.js';

const vectorField = {
  type: TYPE.Vector,
  dimensions: 1536,
  similarity: VectorSimilarity.Cosine,
};

const quote = (identifier: string) => `"${identifier}"`;

describe('vector index lifecycle', () => {
  it('uses consistent default names and always includes Mongo _id filter fields', () => {
    expect(defaultVectorIndexName('embedding')).toBe('embedding_vector');
    expect(defaultVectorIndexName('embedding', 'cnd_Article')).toBe(
      'cnd_Article_embedding_vector',
    );
    expect(mongoVectorFilterFields(['tenantId'])).toEqual(['_id', 'tenantId']);
    expect(mongoVectorFilterFields(['_id', 'tenantId'])).toEqual(['_id', 'tenantId']);
    expect(mongoVectorFilterFields()).toEqual(['_id']);
  });

  it('binds declared indexes to field dimensions/similarity and rejects mismatches', () => {
    const bound = bindVectorIndexToField({
      provider: 'mongodb',
      field: vectorField,
      index: {
        field: 'embedding',
        dimensions: 1536,
        similarity: VectorSimilarity.Cosine,
        filterFields: ['tenantId'],
      },
    });
    expect(bound.name).toBe('embedding_vector');
    expect(bound.filterFields).toEqual(['_id', 'tenantId']);

    expect(() =>
      bindVectorIndexToField({
        provider: 'mongodb',
        field: vectorField,
        index: {
          field: 'embedding',
          dimensions: 768,
          similarity: VectorSimilarity.Cosine,
        },
      }),
    ).toThrow(/dimensions mismatch/);
    expect(() =>
      bindVectorIndexToField({
        provider: 'postgres',
        field: vectorField,
        index: {
          field: 'embedding',
          dimensions: 1536,
          similarity: VectorSimilarity.Cosine,
          method: VectorIndexMethod.Flat,
        },
      }),
    ).toThrow(/Unsupported vector index method/);
  });

  it('maps Atlas search index status to ready/pending/failed queryability', () => {
    expect(mongoSearchIndexReadiness({ status: 'READY' })).toEqual({
      status: VectorIndexStatus.Ready,
      queryable: true,
    });
    expect(mongoSearchIndexReadiness({ status: 'PENDING' })).toEqual({
      status: VectorIndexStatus.Pending,
      queryable: false,
    });
    expect(mongoSearchIndexReadiness({ status: 'FAILED' })).toEqual({
      status: VectorIndexStatus.Failed,
      queryable: false,
    });
    expect(mongoSearchIndexReadiness({ status: 'STALE', queryable: true })).toEqual({
      status: VectorIndexStatus.Ready,
      queryable: true,
    });
  });

  it('fails clearly when a vector index is missing or not queryable', () => {
    try {
      assertVectorIndexQueryable(undefined, { field: 'embedding' });
      throw new Error('expected missing index error');
    } catch (err) {
      expect(err).toBeInstanceOf(GrpcError);
      expect((err as GrpcError).code).toBe(status.FAILED_PRECONDITION);
      expect((err as GrpcError).message).toMatch(/No vector index is available/);
    }
    try {
      assertVectorIndexQueryable(
        {
          name: 'embedding_vector',
          field: 'embedding',
          dimensions: 1536,
          similarity: VectorSimilarity.Cosine,
          status: VectorIndexStatus.Pending,
          queryable: false,
        },
        { field: 'embedding' },
      );
      throw new Error('expected not-ready error');
    } catch (err) {
      expect(err).toBeInstanceOf(GrpcError);
      expect((err as GrpcError).code).toBe(status.FAILED_PRECONDITION);
      expect((err as GrpcError).message).toMatch(/not queryable \(status: pending\)/);
    }
  });

  it('reuses matching Mongo indexes and rejects silent definition changes', () => {
    const requested = bindVectorIndexToField({
      provider: 'mongodb',
      field: vectorField,
      index: {
        name: 'embedding_vector',
        field: 'embedding',
        dimensions: 1536,
        similarity: VectorSimilarity.Cosine,
        method: VectorIndexMethod.HNSW,
        filterFields: ['tenantId'],
      },
    });
    expect(
      planMongoVectorIndexCreate({
        requested,
        existing: [requested],
      }),
    ).toEqual({ action: 'reuse' });
    expect(planMongoVectorIndexCreate({ requested, existing: [] }).action).toBe('create');
    expect(() =>
      planMongoVectorIndexCreate({
        requested,
        existing: [{ ...requested, dimensions: 768 }],
      }),
    ).toThrow(/different definition/);
  });

  it('creates Postgres vector indexes without IF NOT EXISTS and detects mismatches', () => {
    const sql = renderPostgresCreateVectorIndexSql({
      indexName: 'cnd_Article_embedding_vector',
      tableName: 'cnd_Article',
      field: 'embedding',
      method: 'hnsw',
      operator: 'vector_cosine_ops',
      withOptions: ' WITH (m = 16, ef_construction = 64)',
      quoteIdentifier: quote,
    });
    expect(sql).toContain('CREATE INDEX "cnd_Article_embedding_vector"');
    expect(sql).not.toMatch(/IF NOT EXISTS/i);

    expect(
      planPostgresVectorIndexCreate({
        indexName: 'cnd_Article_embedding_vector',
        tableName: 'cnd_Article',
        field: 'embedding',
        method: 'hnsw',
        operator: 'vector_cosine_ops',
        withOptions: '',
        quoteIdentifier: quote,
      }).action,
    ).toBe('create');

    expect(
      planPostgresVectorIndexCreate({
        indexName: 'cnd_Article_embedding_vector',
        tableName: 'cnd_Article',
        field: 'embedding',
        method: 'hnsw',
        operator: 'vector_cosine_ops',
        withOptions: '',
        existing: {
          indexname: 'cnd_Article_embedding_vector',
          tablename: 'cnd_Article',
          indexdef:
            'CREATE INDEX cnd_Article_embedding_vector ON cnd_Article USING hnsw ("embedding" vector_cosine_ops) WITH (m=16, ef_construction=64)',
        },
        quoteIdentifier: quote,
      }),
    ).toEqual({ action: 'reuse' });

    expect(() =>
      planPostgresVectorIndexCreate({
        indexName: 'cnd_Article_embedding_vector',
        tableName: 'cnd_Article',
        field: 'embedding',
        method: 'hnsw',
        operator: 'vector_cosine_ops',
        withOptions: '',
        existing: {
          indexname: 'cnd_Article_embedding_vector',
          tablename: 'cnd_Article',
          indexdef:
            'CREATE INDEX cnd_Article_embedding_vector ON cnd_Article USING ivfflat ("embedding" vector_cosine_ops) WITH (lists=100)',
        },
        quoteIdentifier: quote,
      }),
    ).toThrow(/different definition/);
  });

  it('scopes Postgres vector-index deletion to the requested table', () => {
    expect(() =>
      assertPostgresVectorIndexDropTarget({
        indexName: 'embedding_vector',
        tableName: 'cnd_Article',
        existing: {
          indexname: 'embedding_vector',
          tablename: 'cnd_Other',
          indexdef:
            'CREATE INDEX embedding_vector ON cnd_Other USING hnsw ("embedding" vector_cosine_ops)',
        },
      }),
    ).toThrow(/was not found on table/);
    expect(() =>
      assertPostgresVectorIndexDropTarget({
        indexName: 'title_idx',
        tableName: 'cnd_Article',
        existing: {
          indexname: 'title_idx',
          tablename: 'cnd_Article',
          indexdef: 'CREATE INDEX title_idx ON cnd_Article USING btree (title)',
        },
      }),
    ).toThrow(/is not a vector index/);
    expect(
      assertPostgresVectorIndexDropTarget({
        indexName: 'cnd_Article_embedding_vector',
        tableName: 'cnd_Article',
        existing: {
          indexname: 'cnd_Article_embedding_vector',
          tablename: 'cnd_Article',
          indexdef:
            'CREATE INDEX cnd_Article_embedding_vector ON cnd_Article USING hnsw ("embedding" vector_cosine_ops)',
        },
      }).indexname,
    ).toBe('cnd_Article_embedding_vector');
  });

  it('restores Postgres dimensions and WITH options during catalog read-back', () => {
    const hydrated = hydratePostgresVectorIndex({
      name: 'cnd_Article_embedding_vector',
      indexdef:
        'CREATE INDEX cnd_Article_embedding_vector ON cnd_Article USING hnsw ("embedding" vector_cosine_ops) WITH (m=16, ef_construction=64)',
      field: vectorField,
      declared: {
        field: 'embedding',
        dimensions: 1536,
        similarity: VectorSimilarity.Cosine,
        options: { hnsw: { m: 16 } },
      },
    });
    expect(hydrated).toMatchObject({
      name: 'cnd_Article_embedding_vector',
      field: 'embedding',
      dimensions: 1536,
      similarity: VectorSimilarity.Cosine,
      method: VectorIndexMethod.HNSW,
      status: VectorIndexStatus.Ready,
      queryable: true,
      options: { hnsw: { m: 16, efConstruction: 64 } },
    });
    expect(
      postgresVectorIndexDefinitionMatches(
        'CREATE INDEX cnd_Article_embedding_vector ON cnd_Article USING ivfflat ("embedding" vector_l2_ops) WITH (lists=100)',
        {
          tableName: 'cnd_Article',
          field: 'embedding',
          method: 'ivfflat',
          operator: 'vector_l2_ops',
          options: { ivfflat: { lists: 100 } },
        },
      ),
    ).toBe(true);
  });
});
