import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute } from '../classes/index.js';
import { ConduitRouter } from '../Router.js';
import { RouteToToolConverter } from './RouteToTool.js';

describe('MCP Vector tool schemas', () => {
  it('validates Vector body params as finite numeric arrays without a Vector named type', () => {
    const converter = new RouteToToolConverter({} as ConduitRouter);
    const route = new ConduitRoute(
      {
        path: '/search',
        action: ConduitRouteActions.POST,
        bodyParams: {
          query: { type: TYPE.String, required: true },
          embedding: { type: TYPE.Vector, dimensions: 3, required: true },
          owner: { type: TYPE.Relation, model: 'User' },
        },
      },
      new ConduitRouteReturnDefinition('Search', { hits: TYPE.JSON }),
      async () => ({}),
    );

    const tool = converter.convertRouteToTool(route);
    const schema = z.object(tool.inputSchema);
    const ok = schema.safeParse({
      query: 'hello',
      embedding: [0.1, 0.2, 0.3],
      owner: 'user-1',
    });
    assert.equal(ok.success, true);
    assert.equal(
      schema.safeParse({ query: 'hello', embedding: [0.1, 0.2] }).success,
      false,
    );
    assert.equal(
      schema.safeParse({
        query: 'hello',
        embedding: [0.1, 0.2, Number.POSITIVE_INFINITY],
      }).success,
      false,
    );
    assert.equal(JSON.stringify(tool.inputSchema).includes('Vector'), false);
  });
});
