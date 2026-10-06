import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TYPE } from '@conduitplatform/grpc-sdk';
import { ParserUtils } from './ParserUtils.js';
import { ZodParser } from './ZodParser.js';

const vectorField = {
  type: TYPE.Vector,
  dimensions: 3,
  required: true,
};

describe('ParserUtils Vector helpers', () => {
  it('recognizes Vector shorthand and object form without treating it as a relation', () => {
    assert.equal(ParserUtils.isVectorTypeName(TYPE.Vector), true);
    assert.equal(ParserUtils.isVectorTypeName('Vector'), true);
    assert.equal(ParserUtils.isVectorType(TYPE.Vector), true);
    assert.equal(ParserUtils.isVectorType(vectorField), true);
    assert.equal(ParserUtils.isVectorType(TYPE.JSON), false);
    assert.equal(ParserUtils.isRelationType(vectorField), false);
    assert.equal(ParserUtils.getVectorDimensions(vectorField), 3);
    assert.equal(ParserUtils.getVectorDimensions({ type: TYPE.Vector }), undefined);
    assert.equal(ParserUtils.getVectorDimensions({ dimensions: 1.5 }), undefined);
  });
});

describe('ZodParser Vector validation', () => {
  const parser = new ZodParser();

  it('accepts finite numeric arrays of the declared dimensions', () => {
    const schema = parser.buildZodSchema({
      title: TYPE.String,
      count: TYPE.Number,
      embedding: vectorField,
    });
    const parsed = schema.parse({
      title: 'doc',
      count: 2,
      embedding: [0.1, 0.2, 0.3],
    });
    assert.deepEqual(parsed.embedding, [0.1, 0.2, 0.3]);
    assert.equal(parsed.title, 'doc');
    assert.equal(parsed.count, 2);
  });

  it('rejects non-finite values, wrong length, and shorthand still as a numeric array', () => {
    const schema = parser.buildZodSchema({
      embedding: vectorField,
      raw: TYPE.Vector,
    });
    assert.equal(schema.safeParse({ embedding: [0.1, 0.2] }).success, false);
    assert.equal(schema.safeParse({ embedding: [0.1, 0.2, Number.NaN] }).success, false);
    assert.equal(
      schema.safeParse({ embedding: [0.1, 0.2, Number.POSITIVE_INFINITY] }).success,
      false,
    );
    const shorthand = schema.safeParse({ embedding: [1, 2, 3], raw: [1, 2, 3, 4] });
    assert.equal(shorthand.success, true);
    assert.equal(
      schema.safeParse({ embedding: [1, 2, 3], raw: 'Vector' }).success,
      false,
    );
  });

  it('preserves existing non-vector types including JSON and Relation', () => {
    const schema = parser.buildZodSchema({
      name: TYPE.String,
      active: TYPE.Boolean,
      created: TYPE.Date,
      owner: { type: TYPE.Relation, model: 'User', required: true },
      meta: TYPE.JSON,
    });
    const parsed = schema.parse({
      name: 'ok',
      active: true,
      created: '2026-01-01T00:00:00.000Z',
      owner: '507f1f77bcf86cd799439011',
      meta: { a: 1 },
    });
    assert.equal(parsed.owner, '507f1f77bcf86cd799439011');
    assert.deepEqual(parsed.meta, { a: 1 });
  });
});
