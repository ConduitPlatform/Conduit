import { describe, expect, it, jest } from '@jest/globals';
import {
  GrpcError,
  TYPE,
  VectorIndexMethod,
  VectorIndexStatus,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { DatabaseAdapter } from '../../DatabaseAdapter.js';
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

const declaredIndex = {
  field: 'embedding',
  dimensions: 3,
  similarity: VectorSimilarity.Cosine,
  method: VectorIndexMethod.HNSW,
  filterFields: ['tenantId'],
};

function articleModel() {
  return {
    originalSchema: {
      name: 'Article',
      fields: schemaFields,
      compiledFields: schemaFields,
      collectionName: 'cnd_Article',
      modelOptions: { vectorIndexes: [declaredIndex] },
    },
  };
}

describe('mongoose vector index lifecycle', () => {
  it('creates search indexes with _id filters and default names, reusing matches', async () => {
    const createSearchIndex = jest.fn(async () => undefined);
    const listSearchIndexes = jest.fn(() => ({
      toArray: async () => [],
    }));
    const createIndex = jest.fn(async () => 'title_1');
    const adapter = Object.create(MongooseAdapter.prototype) as MongooseAdapter;
    Object.assign(adapter, {
      models: { Article: articleModel() },
      mongoose: {
        model: () => ({
          collection: { createSearchIndex, listSearchIndexes, createIndex },
        }),
      },
    });

    await adapter.createVectorIndex('Article', declaredIndex);
    expect(createSearchIndex).toHaveBeenCalledWith({
      name: 'embedding_vector',
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: 3,
            similarity: VectorSimilarity.Cosine,
            indexingMethod: VectorIndexMethod.HNSW,
          },
          { type: 'filter', path: '_id' },
          { type: 'filter', path: 'tenantId' },
        ],
      },
    });

    listSearchIndexes.mockImplementation(() => ({
      toArray: async () => [
        {
          name: 'embedding_vector',
          type: 'vectorSearch',
          status: 'READY',
          queryable: true,
          latestDefinition: createSearchIndex.mock.calls[0][0].definition,
        },
      ],
    }));
    await adapter.createVectorIndex('Article', declaredIndex);
    expect(createSearchIndex).toHaveBeenCalledTimes(1);

    await adapter.createIndexes('Article', [{ fields: ['title'] }], 'database');
    expect(createIndex).toHaveBeenCalled();
    expect(createSearchIndex).toHaveBeenCalledTimes(1);
  });

  it('creates explicit hnsw when method is omitted and reuses missing indexingMethod', async () => {
    const createSearchIndex = jest.fn(async () => undefined);
    const listSearchIndexes = jest.fn(() => ({
      toArray: async () => [],
    }));
    const adapter = Object.create(MongooseAdapter.prototype) as MongooseAdapter;
    Object.assign(adapter, {
      models: { Article: articleModel() },
      mongoose: {
        model: () => ({
          collection: { createSearchIndex, listSearchIndexes },
        }),
      },
    });

    const withoutMethod = {
      field: 'embedding',
      dimensions: 3,
      similarity: VectorSimilarity.Cosine,
      filterFields: ['tenantId'],
    };
    await adapter.createVectorIndex('Article', withoutMethod);
    expect(createSearchIndex).toHaveBeenCalledWith({
      name: 'embedding_vector',
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: 3,
            similarity: VectorSimilarity.Cosine,
            indexingMethod: VectorIndexMethod.HNSW,
          },
          { type: 'filter', path: '_id' },
          { type: 'filter', path: 'tenantId' },
        ],
      },
    });

    listSearchIndexes.mockImplementation(() => ({
      toArray: async () => [
        {
          name: 'embedding_vector',
          type: 'vectorSearch',
          status: 'READY',
          queryable: true,
          latestDefinition: {
            fields: [
              {
                type: 'vector',
                path: 'embedding',
                numDimensions: 3,
                similarity: VectorSimilarity.Cosine,
              },
              { type: 'filter', path: '_id' },
              { type: 'filter', path: 'tenantId' },
            ],
          },
        },
      ],
    }));
    await adapter.createVectorIndex('Article', {
      ...withoutMethod,
      method: '' as VectorIndexMethod,
    });
    expect(createSearchIndex).toHaveBeenCalledTimes(1);
  });

  it('rejects vector search against a pending Mongo index', async () => {
    const aggregate = jest.fn();
    const adapter = Object.create(MongooseAdapter.prototype) as MongooseAdapter;
    Object.assign(adapter, {
      models: { Article: articleModel() },
      mongoose: { model: () => ({ collection: { aggregate } }) },
      getVectorIndexes: async () => [
        {
          name: 'embedding_vector',
          field: 'embedding',
          dimensions: 3,
          similarity: VectorSimilarity.Cosine,
          filterFields: ['_id', 'tenantId'],
          status: VectorIndexStatus.Pending,
          queryable: false,
        },
      ],
    });
    try {
      await adapter.vectorSearch({
        schemaName: 'Article',
        field: 'embedding',
        vector: [0.1, 0.2, 0.3],
        limit: 2,
      });
      throw new Error('expected not-ready error');
    } catch (err) {
      expect(err).toBeInstanceOf(GrpcError);
      expect((err as GrpcError).code).toBe(status.FAILED_PRECONDITION);
      expect((err as GrpcError).message).toMatch(/not queryable/);
    }
    expect(aggregate).not.toHaveBeenCalled();
  });

  it('drops Mongo search indexes only after verifying type vectorSearch', async () => {
    const dropSearchIndex = jest.fn(async () => undefined);
    const listSearchIndexes = jest.fn(() => ({
      toArray: async () => [{ name: 'article_text', type: 'search' }],
    }));
    const adapter = Object.create(MongooseAdapter.prototype) as MongooseAdapter;
    Object.assign(adapter, {
      models: { Article: articleModel() },
      mongoose: {
        model: () => ({
          collection: { dropSearchIndex, listSearchIndexes },
        }),
      },
    });
    await expect(adapter.deleteVectorIndex('Article', 'article_text')).rejects.toThrow(
      /is not a vectorSearch index/,
    );
    expect(dropSearchIndex).not.toHaveBeenCalled();

    listSearchIndexes.mockImplementation(() => ({
      toArray: async () => [{ name: 'embedding_vector', type: 'vectorSearch' }],
    }));
    await expect(adapter.deleteVectorIndex('Article', 'embedding_vector')).resolves.toBe(
      'Vector index deleted',
    );
    expect(dropSearchIndex).toHaveBeenCalledWith('embedding_vector');
  });
});

describe('postgres vector index lifecycle', () => {
  it('creates vector indexes without IF NOT EXISTS and restores catalog options', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('pg_indexes') && sql.includes('indexname =')) return [[]];
      if (sql.includes('pg_indexes')) {
        return [
          [
            {
              indexname: 'cnd_Article_embedding_vector',
              tablename: 'cnd_Article',
              indexdef:
                'CREATE INDEX cnd_Article_embedding_vector ON cnd_Article USING hnsw ("embedding" vector_cosine_ops) WITH (m=16, ef_construction=64)',
            },
          ],
        ];
      }
      return [[]];
    });
    const adapter = Object.create(SequelizeAdapter.prototype) as SequelizeAdapter;
    Object.assign(adapter, {
      models: { Article: articleModel() },
      sequelize: {
        getDialect: () => 'postgres',
        escape: (value: unknown) => `'${value}'`,
        query,
      },
    });

    await adapter.createVectorIndex('Article', {
      ...declaredIndex,
      options: { hnsw: { m: 16, efConstruction: 64 } },
    });
    const createSql = query.mock.calls.find(call =>
      String(call[0]).startsWith('CREATE INDEX'),
    )?.[0] as string;
    expect(createSql).toContain('CREATE INDEX "cnd_Article_embedding_vector"');
    expect(createSql).not.toMatch(/IF NOT EXISTS/i);

    const indexes = await adapter.getVectorIndexes('Article');
    expect(indexes[0]).toMatchObject({
      dimensions: 3,
      similarity: VectorSimilarity.Cosine,
      method: VectorIndexMethod.HNSW,
      status: VectorIndexStatus.Ready,
      queryable: true,
      options: { hnsw: { m: 16, efConstruction: 64 } },
    });
  });

  it('does not drop a vector index that belongs to another table', async () => {
    const query = jest.fn(async () => [
      [
        {
          indexname: 'embedding_vector',
          tablename: 'cnd_Other',
          indexdef:
            'CREATE INDEX embedding_vector ON cnd_Other USING hnsw ("embedding" vector_cosine_ops)',
        },
      ],
    ]);
    const adapter = Object.create(SequelizeAdapter.prototype) as SequelizeAdapter;
    Object.assign(adapter, {
      models: { Article: articleModel() },
      sequelize: {
        getDialect: () => 'postgres',
        escape: (value: unknown) => `'${value}'`,
        query,
      },
    });
    await expect(
      adapter.deleteVectorIndex('Article', 'embedding_vector'),
    ).rejects.toThrow(/was not found on table/);
    expect(query.mock.calls.some(call => String(call[0]).startsWith('DROP INDEX'))).toBe(
      false,
    );
  });
});

describe('declared vectorIndexes application', () => {
  it('applies modelOptions.vectorIndexes through createVectorIndex, not regular indexes', async () => {
    const createVectorIndex = jest.fn(async () => 'Vector index created!');
    const createIndexes = jest.fn(async () => 'Indexes created!');
    const adapter = Object.create(DatabaseAdapter.prototype) as DatabaseAdapter<any>;
    Object.assign(adapter, {
      models: { Article: articleModel() },
      createVectorIndex,
      createIndexes,
      getVectorCapabilities: async () => ({
        supported: true,
        storage: true,
        indexing: true,
        search: true,
        provider: 'mongodb',
      }),
    });

    await (adapter as any).applyDeclaredVectorIndexes('Article', false);
    expect(createVectorIndex).toHaveBeenCalledWith('Article', declaredIndex);
    expect(createIndexes).not.toHaveBeenCalled();

    await (adapter as any).applyDeclaredVectorIndexes('Article', true);
    expect(createVectorIndex).toHaveBeenCalledTimes(1);

    Object.assign(adapter, {
      getVectorCapabilities: async () => ({
        supported: false,
        storage: true,
        indexing: false,
        search: false,
        provider: 'unsupported',
      }),
    });
    await (adapter as any).applyDeclaredVectorIndexes('Article', false);
    expect(createVectorIndex).toHaveBeenCalledTimes(1);
  });
});
