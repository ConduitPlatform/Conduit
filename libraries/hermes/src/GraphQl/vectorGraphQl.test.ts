import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TYPE } from '@conduitplatform/grpc-sdk';
import { GraphQlParser } from './GraphQlParser.js';
import { processParams } from './utils/SimpleTypeParamUtils.js';

describe('GraphQL Vector mapping', () => {
  it('renders Vector fields as [Number] and does not request a Vector type', () => {
    const parser = new GraphQlParser();
    const result = parser.extractTypes(
      'Doc',
      {
        title: TYPE.String,
        count: TYPE.Number,
        embedding: { type: TYPE.Vector, dimensions: 8 },
        owner: { type: TYPE.Relation, model: 'User' },
        payload: TYPE.JSON,
      },
      false,
    );

    assert.equal(parser.requestedTypes.has('Vector'), false);
    assert.equal(parser.requestedTypes.has('User'), true);
    assert.match(result.typeString, /embedding: \[Number]/);
    assert.match(result.typeString, /title: String/);
    assert.match(result.typeString, /count: Number/);
    assert.match(result.typeString, /payload: JSONObject/);
    assert.equal(/\btype Vector\b/.test(result.typeString), false);
    assert.equal(/: Vector\b/.test(result.typeString), false);
  });

  it('maps simple Vector parameters to [Number] rather than a Vector named type', () => {
    const params = processParams(
      {
        q: TYPE.String,
        embedding: { type: TYPE.Vector, dimensions: 3, required: true },
        ids: [TYPE.ObjectId],
      },
      '',
    );
    assert.match(params, /q:String/);
    assert.match(params, /embedding:\[Number]!/);
    assert.match(params, /ids:\[ID]/);
    assert.equal(params.includes('Vector'), false);
  });
});
