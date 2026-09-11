import { describe, expect, it } from '@jest/globals';
import { TYPE } from '@conduitplatform/grpc-sdk';
import { mongoVectorProjection, postgresVectorSelectList } from '../vectorProjection.js';

const schemaFields = {
  _id: { type: TYPE.ObjectId },
  title: { type: TYPE.String },
  embedding: { type: TYPE.Vector, dimensions: 8, select: false },
  sourceHash: { type: TYPE.String, select: false },
};

describe('vector search projections', () => {
  it('keeps select:false fields out of Mongo include and exclude projections', () => {
    expect(mongoVectorProjection(schemaFields, 'title embedding')).toEqual({
      _id: 1,
      _score: 1,
      title: 1,
    });
    expect(mongoVectorProjection(schemaFields, '-title')).toEqual({
      embedding: 0,
      sourceHash: 0,
      title: 0,
    });
    expect(mongoVectorProjection(schemaFields)).toEqual({
      embedding: 0,
      sourceHash: 0,
    });
  });

  it('keeps select:false fields out of Postgres select lists', () => {
    const quote = (identifier: string) => `"${identifier}"`;
    expect(postgresVectorSelectList(schemaFields, 'title embedding', quote)).toBe(
      '"title", "_id"',
    );
    expect(postgresVectorSelectList(schemaFields, undefined, quote)).toBe(
      '"_id", "title"',
    );
    expect(postgresVectorSelectList(schemaFields, '-title', quote)).toBe('"_id"');
  });
});
