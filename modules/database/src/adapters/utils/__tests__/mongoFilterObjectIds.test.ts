import { describe, expect, it, jest } from '@jest/globals';
import {
  GrpcError,
  TYPE,
  VectorIndexStatus,
  VectorSimilarity,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { Types } from 'mongoose';
import {
  castMongoFilterObjectIds,
  castMongoPipelineObjectIds,
  findMongoAggregationOperator,
  mongoObjectIdFields,
} from '../mongoFilterObjectIds.js';
import { planMongoVectorSearch } from '../vectorSearchQuery.js';
import { MongooseAdapter } from '../../mongoose-adapter/index.js';

const ID_A = '6ac54569e97c84ee08f0c945';
const ID_B = '6ac5456ae97c84ee08f0c97c';
const VERSION = '6ac54560e97c84ee08f0bb22';

const schemaFields = {
  _id: { type: TYPE.ObjectId },
  text: { type: TYPE.String },
  status: { type: TYPE.String },
  version: { type: TYPE.Relation, model: 'DocumentVersion' },
  tags: [{ type: TYPE.Relation, model: 'Tag' }],
  embedding: {
    type: TYPE.Vector,
    dimensions: 3,
    similarity: VectorSimilarity.Cosine,
    select: false,
  },
};

const objectIdFields = mongoObjectIdFields(schemaFields);

describe('Mongo filter ObjectId casting', () => {
  it('treats _id, ObjectId fields, and Relations as ObjectId fields', () => {
    expect([...objectIdFields].sort()).toEqual(['_id', 'tags', 'version']);
    expect([...mongoObjectIdFields({})]).toEqual(['_id']);
  });

  it('casts hex strings in $in, equality, and logical branches on ObjectId fields only', () => {
    const cast = castMongoFilterObjectIds(
      {
        _id: { $in: [ID_A, ID_B] },
        status: 'active',
        $or: [{ version: VERSION }, { version: { $ne: ID_A } }, { text: ID_B }],
      },
      objectIdFields,
    );
    expect(cast._id.$in).toEqual([new Types.ObjectId(ID_A), new Types.ObjectId(ID_B)]);
    expect(cast._id.$in[0]).toBeInstanceOf(Types.ObjectId);
    expect(cast.status).toBe('active');
    expect(cast.$or[0].version).toEqual(new Types.ObjectId(VERSION));
    expect(cast.$or[1].version.$ne).toEqual(new Types.ObjectId(ID_A));
    expect(cast.$or[2].text).toBe(ID_B);
  });

  it('casts $all, $elemMatch, and exact array matches on array Relations', () => {
    const cast = castMongoFilterObjectIds(
      {
        $and: [
          { tags: { $all: [ID_A, ID_B] } },
          { tags: { $elemMatch: { $eq: ID_A } } },
          { tags: [ID_B] },
        ],
      },
      objectIdFields,
    );
    expect(cast.$and[0].tags.$all).toEqual([
      new Types.ObjectId(ID_A),
      new Types.ObjectId(ID_B),
    ]);
    expect(cast.$and[1].tags.$elemMatch.$eq).toEqual(new Types.ObjectId(ID_A));
    expect(cast.$and[2].tags).toEqual([new Types.ObjectId(ID_B)]);
  });

  it('leaves non-comparison operands and values that are not 24-hex strings untouched', () => {
    const filter = {
      _id: { $in: ['not-an-id', 42, null] },
      version: { $not: { $eq: 'abc' } },
      tags: { $regex: ID_A, $exists: true },
    };
    expect(castMongoFilterObjectIds(filter, objectIdFields)).toEqual(filter);
  });

  it('finds aggregation operators anywhere in a filter, but not $text $search', () => {
    expect(findMongoAggregationOperator({ status: 'active' })).toBeUndefined();
    expect(
      findMongoAggregationOperator({ $text: { $search: 'hello' }, _id: { $in: [ID_A] } }),
    ).toBeUndefined();
    expect(
      findMongoAggregationOperator({
        $or: [{ status: 'a' }, { $expr: { $eq: [1, 1] } }],
      }),
    ).toBe('$expr');
    expect(findMongoAggregationOperator({ $where: 'this.a > 1' })).toBe('$where');
    expect(
      findMongoAggregationOperator({ version: { $in: [{ $lookup: { from: 'x' } }] } }),
    ).toBe('$lookup');
  });

  it('rejects filters that carry aggregation operators', () => {
    expect(() =>
      castMongoFilterObjectIds(
        { _id: ID_A, $expr: { $eq: ['$version', { $toObjectId: VERSION }] } },
        objectIdFields,
      ),
    ).toThrow(
      new GrpcError(
        status.INVALID_ARGUMENT,
        "Filter must not contain aggregation operator '$expr'",
      ),
    );
    expect(() =>
      castMongoFilterObjectIds({ $function: { body: '' } }, objectIdFields),
    ).toThrow(GrpcError);
  });

  it('plans a Mongo $vectorSearch whose _id filter holds ObjectIds', () => {
    const planned = planMongoVectorSearch({
      request: {
        schemaName: 'DocumentChunk',
        field: 'embedding',
        vector: [0.1, 0.2, 0.3],
        filter: { _id: { $in: [ID_A] } },
        limit: 8,
      },
      indexes: [
        {
          name: 'embedding_vector',
          field: 'embedding',
          dimensions: 3,
          similarity: VectorSimilarity.Cosine,
          filterFields: ['_id'],
          status: VectorIndexStatus.Ready,
          queryable: true,
        },
      ],
      schemaFields,
    });
    const stage = planned.pipeline[0].$vectorSearch;
    expect(stage.filter._id.$in).toEqual([new Types.ObjectId(ID_A)]);
    expect(stage.filter._id.$in[0]).toBeInstanceOf(Types.ObjectId);
  });
});

describe('Mongo pipeline ObjectId casting', () => {
  it('casts every $match before the first reshaping stage', () => {
    const pipeline = castMongoPipelineObjectIds(
      [
        { $match: { _id: ID_A } },
        { $sort: { createdAt: -1 } },
        { $limit: 10 },
        { $match: { version: { $in: [VERSION] } } },
        { $project: { version: 1 } },
        { $match: { version: VERSION } },
      ],
      objectIdFields,
    ) as any[];
    expect(pipeline[0].$match._id).toEqual(new Types.ObjectId(ID_A));
    expect(pipeline[1]).toEqual({ $sort: { createdAt: -1 } });
    expect(pipeline[3].$match.version.$in).toEqual([new Types.ObjectId(VERSION)]);
    expect(pipeline[5].$match.version).toBe(VERSION);
  });

  it('stops at $lookup, since later stages may see joined fields', () => {
    const pipeline = castMongoPipelineObjectIds(
      [
        { $lookup: { from: 'cnd_versions', as: 'version' } },
        { $match: { version: VERSION } },
      ],
      objectIdFields,
    ) as any[];
    expect(pipeline[1].$match.version).toBe(VERSION);
  });

  it('leaves a $match using $expr as is and keeps casting later $match stages', () => {
    const exprMatch = {
      $match: { $expr: { $eq: ['$version', { $toObjectId: VERSION }] }, _id: ID_A },
    };
    const pipeline = castMongoPipelineObjectIds(
      [exprMatch, { $match: { _id: ID_B } }],
      objectIdFields,
    ) as any[];
    expect(pipeline[0]).toBe(exprMatch);
    expect(pipeline[1].$match._id).toEqual(new Types.ObjectId(ID_B));
  });

  it('returns values that are not pipelines unchanged', () => {
    expect(castMongoPipelineObjectIds(undefined, objectIdFields)).toBeUndefined();
    expect(castMongoPipelineObjectIds({ $match: {} }, objectIdFields)).toEqual({
      $match: {},
    });
  });
});

describe('mongoose rawQuery aggregate', () => {
  function adapterWith(aggregate: jest.Mock, find: jest.Mock) {
    const adapter = Object.create(MongooseAdapter.prototype) as MongooseAdapter;
    Object.assign(adapter, {
      models: {
        DocumentChunk: {
          originalSchema: { fields: schemaFields, compiledFields: schemaFields },
          model: { collection: { aggregate, find } },
        },
      },
      views: {},
    });
    return adapter;
  }

  it('casts ObjectId strings in the leading $match stage', async () => {
    const aggregate = jest.fn(() => ({ toArray: async () => [] }));
    const adapter = adapterWith(aggregate, jest.fn());
    await adapter.execRawQuery('DocumentChunk', {
      aggregate: [
        { $match: { version: VERSION, status: 'active' } },
        { $count: 'total' },
      ],
    });
    const pipeline = (aggregate.mock.calls[0] as unknown[])[0] as any[];
    expect(pipeline[0].$match).toEqual({
      version: new Types.ObjectId(VERSION),
      status: 'active',
    });
    expect(pipeline[1]).toEqual({ $count: 'total' });
  });

  it('does not cast non-aggregate raw queries', async () => {
    const find = jest.fn(() => []);
    const adapter = adapterWith(jest.fn(), find);
    await adapter.execRawQuery('DocumentChunk', { find: { version: VERSION } });
    expect((find.mock.calls[0] as unknown[])[0]).toEqual({ version: VERSION });
  });
});
