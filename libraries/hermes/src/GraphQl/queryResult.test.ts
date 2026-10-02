import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute } from '../classes/index.js';
import { GraphQLController } from './GraphQL.js';

const fakeSdk = {
  waitForExistence: () => new Promise(() => {}),
  bus: { subscribe: () => {} },
} as unknown as ConduitGrpcSdk;

function runQuery(handlerResult: unknown) {
  const controller = new GraphQLController(fakeSdk);
  const route = new ConduitRoute(
    { path: '/function/test', action: ConduitRouteActions.GET },
    new ConduitRouteReturnDefinition('GETtest', { result: [{ name: TYPE.String }] }),
    async () => handlerResult,
  );
  controller.registerConduitRoute(route);
  (controller as any).shouldPopulate = (args: unknown) => args;
  const resolver = controller.resolvers.Query['getFunctionTest'];
  return resolver({}, {}, { headers: {} }, {});
}

describe('GraphQL query resolver result shape', () => {
  it('wraps a list returned by the handler as { result }', async () => {
    const result = runQuery({ result: JSON.stringify([{ name: 'a' }]) });
    assert.deepEqual(await result, { result: [{ name: 'a' }] });
  });

  it('wraps an empty list returned by the handler as { result: [] }', async () => {
    const result = runQuery({ result: JSON.stringify([]) });
    assert.deepEqual(await result, { result: [] });
  });

  it('leaves an object result (e.g. paginated) untouched', async () => {
    const paginated = { documents: [{ name: 'a' }], count: 1 };
    const result = runQuery({ result: JSON.stringify(paginated) });
    assert.deepEqual(await result, paginated);
  });
});
