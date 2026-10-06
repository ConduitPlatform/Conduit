import { describe, expect, it } from '@jest/globals';
import { TYPE, VectorIndexStatus, VectorSimilarity } from '@conduitplatform/grpc-sdk';
import { Types } from 'mongoose';
import {
  castMongoVectorFilterObjectIds,
  mongoObjectIdFields,
} from '../vectorSearchObjectIds.js';
import { planMongoVectorSearch } from '../vectorSearchQuery.js';

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

describe('vector search ObjectId filter casting', () => {
  it('treats _id, ObjectId fields, and Relations as ObjectId fields', () => {
    expect([...mongoObjectIdFields(schemaFields)].sort()).toEqual([
      '_id',
      'tags',
      'version',
    ]);
    expect([...mongoObjectIdFields({})]).toEqual(['_id']);
  });

  it('casts hex strings in $in, equality, and logical branches on ObjectId fields only', () => {
    const cast = castMongoVectorFilterObjectIds(
      {
        _id: { $in: [ID_A, ID_B] },
        status: 'active',
        $or: [{ version: VERSION }, { version: { $ne: ID_A } }, { text: ID_B }],
      },
      mongoObjectIdFields(schemaFields),
    );
    expect(cast._id.$in).toEqual([new Types.ObjectId(ID_A), new Types.ObjectId(ID_B)]);
    expect(cast._id.$in[0]).toBeInstanceOf(Types.ObjectId);
    expect(cast.status).toBe('active');
    expect(cast.$or[0].version).toEqual(new Types.ObjectId(VERSION));
    expect(cast.$or[1].version.$ne).toEqual(new Types.ObjectId(ID_A));
    expect(cast.$or[2].text).toBe(ID_B);
  });

  it('leaves values that are not 24-hex strings untouched', () => {
    const cast = castMongoVectorFilterObjectIds(
      { _id: { $in: ['not-an-id', 42, null] }, version: { $not: { $eq: 'abc' } } },
      mongoObjectIdFields(schemaFields),
    );
    expect(cast).toEqual({
      _id: { $in: ['not-an-id', 42, null] },
      version: { $not: { $eq: 'abc' } },
    });
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
