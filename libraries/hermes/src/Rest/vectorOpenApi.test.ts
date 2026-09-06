import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TYPE } from '@conduitplatform/grpc-sdk';
import { SwaggerParser } from './SwaggerParser.js';
import { processSwaggerParams } from './SimpleTypeParamUtils.js';

function assertNoPhantomVector(value: unknown) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes('#/components/schemas/Vector'), false);
  assert.equal(serialized.includes('"Vector"'), false);
}

describe('OpenAPI Vector mapping', () => {
  it('emits a numeric array with dimensions and never a Vector $ref', () => {
    const parser = new SwaggerParser();
    const result = parser.extractTypes(
      'Doc',
      {
        title: TYPE.String,
        embedding: { type: TYPE.Vector, dimensions: 8, required: true },
        owner: { type: TYPE.Relation, model: 'User' },
        payload: TYPE.JSON,
      },
      false,
    );

    assert.equal(parser.requestedTypes.has('Vector'), false);
    assert.equal(parser.requestedTypes.has('User'), true);
    assertNoPhantomVector(result);
    assert.deepEqual(
      (result as { properties: Record<string, unknown> }).properties.embedding,
      {
        type: 'array',
        items: { type: 'number' },
        minItems: 8,
        maxItems: 8,
      },
    );
    assert.equal(
      (
        (result as { properties: Record<string, { type?: string }> }).properties
          .title as { type?: string }
      ).type,
      'string',
    );
    assert.equal(
      (
        (result as { properties: Record<string, { type?: string }> }).properties
          .payload as { type?: string }
      ).type,
      'object',
    );
  });

  it('maps simple Vector params to numeric arrays with dimensions where present', () => {
    assert.deepEqual(processSwaggerParams(TYPE.Vector), {
      type: 'array',
      items: { type: 'number' },
    });
    assert.deepEqual(
      processSwaggerParams({ type: TYPE.Vector, dimensions: 4, required: true }),
      {
        type: 'array',
        items: { type: 'number' },
        minItems: 4,
        maxItems: 4,
      },
    );
    assert.deepEqual(processSwaggerParams(TYPE.Number), { type: 'number' });
    assert.deepEqual(processSwaggerParams(TYPE.JSON), { type: 'object' });
    assertNoPhantomVector(processSwaggerParams({ type: TYPE.Vector, dimensions: 2 }));
  });
});
