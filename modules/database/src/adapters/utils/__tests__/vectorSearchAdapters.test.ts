import { describe, expect, it, jest } from '@jest/globals';
import { TYPE, VectorSimilarity } from '@conduitplatform/grpc-sdk';
import { MongooseAdapter } from '../../mongoose-adapter/index.js';
import { SequelizeAdapter } from '../../sequelize-adapter/index.js';

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

function articleModel(overrides?: {
  authzEnabled?: boolean;
  lookupAuthorizedCandidateIds?: (ids: string[]) => Promise<string[]>;
  getAuthorizedQuery?: (...args: unknown[]) => Promise<unknown>;
}) {
  const resolveIds =
    overrides?.lookupAuthorizedCandidateIds ?? (async (ids: string[]) => ids);
  return {
    authzEnabled: overrides?.authzEnabled ?? true,
    originalSchema: {
      name: 'Article',
      fields: schemaFields,
      compiledFields: schemaFields,
      collectionName: 'cnd_Article',
      modelOptions: {
        conduit: { authorization: { enabled: overrides?.authzEnabled ?? true } },
        vectorIndexes: [
          {
            name: 'embedding_vector',
            field: 'embedding',
            dimensions: 3,
            similarity: VectorSimilarity.Cosine,
            filterFields: ['_id', 'tenantId'],
          },
        ],
      },
    },
    lookupAuthorizedCandidateIds: jest.fn(async (_operation: string, ids: string[]) =>
      resolveIds(ids),
    ),
    getAuthorizedQuery: jest.fn(
      overrides?.getAuthorizedQuery ?? (async () => ({ _id: { $in: ['all-docs'] } })),
    ),
  };
}

const searchRequest = {
  schemaName: 'Article',
  field: 'embedding',
  vector: [0.1, 0.2, 0.3],
  filter: { tenantId: 'org-1' },
  limit: 2,
  numCandidates: 4,
  select: 'title embedding',
  userId: 'user-1',
};

describe('mongoose vector search adapter', () => {
  it('runs ANN with indexed prefilters then authorizes only candidate ids', async () => {
    const model = articleModel({
      lookupAuthorizedCandidateIds: async ids => ids.filter(id => id !== 'denied'),
    });
    const aggregate = jest.fn(() => ({
      toArray: async () => [
        { _id: 'a', title: 'one', _score: 0.9 },
        { _id: 'denied', title: 'secret', _score: 0.8 },
        { _id: 'b', title: 'two', _score: 0.7 },
      ],
    }));
    const adapter = Object.create(MongooseAdapter.prototype) as MongooseAdapter;
    Object.assign(adapter, {
      models: { Article: model },
      mongoose: {
        model: () => ({ collection: { aggregate } }),
      },
      getVectorIndexes: async () => model.originalSchema.modelOptions.vectorIndexes,
    });

    const results = await adapter.vectorSearch(searchRequest);

    expect(model.getAuthorizedQuery).not.toHaveBeenCalled();
    expect(model.lookupAuthorizedCandidateIds).toHaveBeenCalledWith(
      'read',
      ['a', 'denied', 'b'],
      'user-1',
      undefined,
    );
    expect(aggregate.mock.calls[0][0][0].$vectorSearch).toMatchObject({
      filter: { tenantId: 'org-1' },
      limit: 4,
      numCandidates: 4,
    });
    expect(aggregate.mock.calls[0][0][0].$vectorSearch.filter).not.toHaveProperty('_id');
    expect(aggregate.mock.calls[0][0][2].$project).toEqual({
      _id: 1,
      _score: 1,
      title: 1,
    });
    expect(results.map(result => result.document._id)).toEqual(['a', 'b']);
    expect(results[0]).toMatchObject({
      score: 0.9,
      provider: 'mongodb',
      metric: VectorSimilarity.Cosine,
    });
    expect(results[0].document).not.toHaveProperty('embedding');
  });

  it('does not query Mongo when an empty $in filter matches no rows', async () => {
    const model = articleModel();
    const aggregate = jest.fn();
    const adapter = Object.create(MongooseAdapter.prototype) as MongooseAdapter;
    Object.assign(adapter, {
      models: { Article: model },
      mongoose: { model: () => ({ collection: { aggregate } }) },
      getVectorIndexes: async () => model.originalSchema.modelOptions.vectorIndexes,
    });
    const results = await adapter.vectorSearch({
      ...searchRequest,
      filter: { tenantId: { $in: [] } },
    });
    expect(results).toEqual([]);
    expect(aggregate).not.toHaveBeenCalled();
    expect(model.lookupAuthorizedCandidateIds).not.toHaveBeenCalled();
  });
});

describe('postgres vector search adapter', () => {
  it('keeps user filters in SQL, hides select:false columns, and authorizes candidates only', async () => {
    const model = articleModel({
      lookupAuthorizedCandidateIds: async ids => ids.filter(id => id !== 'denied'),
    });
    const query = jest.fn(async () => [
      [
        { _id: 'a', title: 'one', _score: 0.2 },
        { _id: 'denied', title: 'secret', _score: 0.3 },
        { _id: 'b', title: 'two', _score: 0.5 },
      ],
    ]);
    const adapter = Object.create(SequelizeAdapter.prototype) as SequelizeAdapter;
    Object.assign(adapter, {
      models: { Article: model },
      sequelize: {
        getDialect: () => 'postgres',
        escape: (value: unknown) =>
          typeof value === 'string' ? `'${value}'` : String(value),
        query,
      },
      getVectorIndexes: async () => model.originalSchema.modelOptions.vectorIndexes,
    });

    const results = await adapter.vectorSearch(searchRequest);
    const sql = query.mock.calls[0][0] as string;

    expect(model.getAuthorizedQuery).not.toHaveBeenCalled();
    expect(sql).toContain('WHERE "tenantId" = \'org-1\'');
    expect(sql).toContain('LIMIT 4');
    expect(sql).toMatch(/^SELECT "title", "_id",/);
    expect(sql).not.toContain('all-docs');
    expect(results).toEqual([
      {
        document: { _id: 'a', title: 'one' },
        score: 0.8,
        distance: 0.2,
        metric: VectorSimilarity.Cosine,
        provider: 'postgres',
      },
      {
        document: { _id: 'b', title: 'two' },
        score: 0.5,
        distance: 0.5,
        metric: VectorSimilarity.Cosine,
        provider: 'postgres',
      },
    ]);
  });

  it('does not query Postgres when empty $in matches no rows', async () => {
    const model = articleModel();
    const query = jest.fn();
    const adapter = Object.create(SequelizeAdapter.prototype) as SequelizeAdapter;
    Object.assign(adapter, {
      models: { Article: model },
      sequelize: {
        getDialect: () => 'postgres',
        escape: (value: unknown) => `'${value}'`,
        query,
      },
      getVectorIndexes: async () => [],
    });
    const results = await adapter.vectorSearch({
      ...searchRequest,
      filter: { tenantId: { $in: [] } },
    });
    expect(results).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });
});
