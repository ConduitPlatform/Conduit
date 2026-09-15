import { describe, expect, it, jest } from '@jest/globals';
import {
  GrpcError,
  TYPE,
  VectorIndexStatus,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import {
  completeVectorSearch,
  mergeVectorIndexes,
  planMongoVectorSearch,
  planPostgresVectorSearch,
} from '../vectorSearchQuery.js';

const schemaFields = {
  _id: { type: TYPE.ObjectId },
  title: { type: TYPE.String },
  tenantId: { type: TYPE.String },
  embedding: {
    type: TYPE.Vector,
    dimensions: 3,
    similarity: VectorSimilarity.Cosine,
    select: false,
  },
};

const indexes = [
  {
    name: 'embedding_vector',
    field: 'embedding',
    dimensions: 3,
    similarity: VectorSimilarity.Cosine,
    filterFields: ['_id', 'tenantId'],
    status: VectorIndexStatus.Ready,
    queryable: true,
  },
];

const request = {
  schemaName: 'Article',
  field: 'embedding',
  vector: [0.1, 0.2, 0.3],
  filter: { tenantId: 'org-1' },
  limit: 2,
  numCandidates: 5,
  select: 'title embedding',
};

describe('vector search query planning', () => {
  it('builds a Mongo Atlas pipeline with indexed prefilters and hidden-field projection', () => {
    const planned = planMongoVectorSearch({ request, indexes, schemaFields });
    expect(planned.emptyResult).toBe(false);
    expect(planned.limits).toEqual({ limit: 2, numCandidates: 5 });
    expect(planned.pipeline[0]).toEqual({
      $vectorSearch: {
        index: 'embedding_vector',
        path: 'embedding',
        queryVector: request.vector,
        numCandidates: 5,
        limit: 5,
        filter: { tenantId: 'org-1' },
      },
    });
    expect(planned.pipeline[2]).toEqual({
      $project: { _id: 1, _score: 1, title: 1 },
    });
  });

  it('selects the highest generation live index when a named request is not provided', () => {
    const planned = planMongoVectorSearch({
      request,
      indexes: [
        indexes[0],
        {
          ...indexes[0],
          name: 'embedding_vector_v2',
        },
      ],
      schemaFields,
    });
    expect(planned.pipeline[0]).toEqual({
      $vectorSearch: {
        index: 'embedding_vector_v2',
        path: 'embedding',
        queryVector: request.vector,
        numCandidates: 5,
        limit: 5,
        filter: { tenantId: 'org-1' },
      },
    });
    expect(() =>
      planMongoVectorSearch({
        request,
        indexes: [
          indexes[0],
          {
            ...indexes[0],
            name: 'embedding_vector_v2',
            status: VectorIndexStatus.Pending,
            queryable: false,
          },
        ],
        schemaFields,
      }),
    ).toThrow(/not queryable/);
  });

  it('short-circuits empty Mongo $in without emitting a pipeline', () => {
    const planned = planMongoVectorSearch({
      request: { ...request, filter: { tenantId: { $in: [] } } },
      indexes,
      schemaFields,
    });
    expect(planned.emptyResult).toBe(true);
    expect(planned.pipeline).toEqual([]);
  });

  it('renders Postgres SQL that keeps filters, hides select:false columns, and fetches candidates', () => {
    const planned = planPostgresVectorSearch({
      request,
      indexes,
      schemaFields,
      tableName: 'cnd_Article',
      similarity: VectorSimilarity.Cosine,
      renderer: {
        quoteIdentifier: identifier => `"${identifier}"`,
        escape: value => (typeof value === 'string' ? `'${value}'` : String(value)),
      },
    });
    expect(planned.emptyResult).toBe(false);
    expect(planned.sql).toContain('WHERE "tenantId" = \'org-1\'');
    expect(planned.sql).toContain('LIMIT 5');
    expect(planned.sql).toMatch(/^SELECT "title", "_id",/);
    expect(planned.sql).toContain('<=>');
  });

  it('fails clearly when the selected vector index is not queryable', () => {
    expect(() =>
      planMongoVectorSearch({
        request,
        indexes: [
          {
            ...indexes[0],
            status: VectorIndexStatus.Pending,
            queryable: false,
          },
        ],
        schemaFields,
      }),
    ).toThrow(GrpcError);
    try {
      planMongoVectorSearch({
        request,
        indexes: [
          {
            ...indexes[0],
            status: VectorIndexStatus.Failed,
            queryable: false,
          },
        ],
        schemaFields,
      });
      throw new Error('expected failed index error');
    } catch (err) {
      expect(err).toBeInstanceOf(GrpcError);
      expect((err as GrpcError).code).toBe(status.FAILED_PRECONDITION);
      expect((err as GrpcError).message).toMatch(/not queryable/);
    }
  });

  it('does not treat declared-only modelOptions vector indexes as live or queryable', () => {
    const declaredOnly = mergeVectorIndexes(indexes, []);
    expect(declaredOnly).toEqual([]);
    expect(() =>
      planMongoVectorSearch({
        request,
        indexes: declaredOnly,
        schemaFields,
      }),
    ).toThrow(GrpcError);
    const livePending = mergeVectorIndexes(indexes, [
      {
        ...indexes[0],
        status: VectorIndexStatus.Pending,
        queryable: false,
      },
    ]);
    expect(livePending[0]).toMatchObject({
      status: VectorIndexStatus.Pending,
      queryable: false,
    });
    expect(() =>
      planMongoVectorSearch({
        request,
        indexes: livePending,
        schemaFields,
      }),
    ).toThrow(/not queryable/);
  });
});

describe('bounded vector search completion', () => {
  it('authorizes only ANN candidate ids and returns normalized higher-is-better scores', async () => {
    const lookupAuthorizedIds = jest.fn(async (ids: string[]) =>
      ids.filter(id => id !== 'denied'),
    );
    const results = await completeVectorSearch({
      emptyResult: false,
      limit: 2,
      authzEnabled: true,
      provider: 'postgres',
      metric: VectorSimilarity.Cosine,
      fetchCandidates: async () => [
        { _id: 'a', title: 'one', _score: 0.1 },
        { _id: 'denied', title: 'secret', _score: 0.2 },
        { _id: 'b', title: 'two', _score: 0.4 },
        { _id: 'c', title: 'three', _score: 0.5 },
      ],
      lookupAuthorizedIds,
    });
    expect(lookupAuthorizedIds).toHaveBeenCalledWith(['a', 'denied', 'b', 'c']);
    expect(results).toEqual([
      {
        document: { _id: 'a', title: 'one' },
        score: 0.9,
        distance: 0.1,
        metric: VectorSimilarity.Cosine,
        provider: 'postgres',
      },
      {
        document: { _id: 'b', title: 'two' },
        score: 0.6,
        distance: 0.4,
        metric: VectorSimilarity.Cosine,
        provider: 'postgres',
      },
    ]);
  });

  it('does not call authorization lookup for admin operator or empty $in results', async () => {
    const lookupAuthorizedIds = jest.fn(async (ids: string[]) => ids);
    await completeVectorSearch({
      emptyResult: true,
      limit: 2,
      authzEnabled: true,
      provider: 'mongodb',
      metric: VectorSimilarity.Cosine,
      fetchCandidates: async () => [{ _id: 'a', _score: 1 }],
      lookupAuthorizedIds,
    });
    expect(lookupAuthorizedIds).not.toHaveBeenCalled();

    const results = await completeVectorSearch({
      emptyResult: false,
      limit: 1,
      authzEnabled: true,
      adminOperator: true,
      provider: 'mongodb',
      metric: VectorSimilarity.Cosine,
      fetchCandidates: async () => [
        { _id: 'a', _score: 0.9 },
        { _id: 'b', _score: 0.8 },
      ],
      lookupAuthorizedIds,
    });
    expect(lookupAuthorizedIds).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      score: 0.9,
      provider: 'mongodb',
      metric: VectorSimilarity.Cosine,
    });
    expect(results[0].distance).toBeUndefined();
  });
});
