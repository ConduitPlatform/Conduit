import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GrpcError, ParsedRouterRequest } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { validateParams } from '../../../../libraries/hermes/dist/Rest/util.js';
import { CLIENT_SEMANTIC_SEARCH_ROUTE, clientSearchCall } from '../routes/index.js';

function searchCall(
  overrides: {
    context?: ParsedRouterRequest['request']['context'];
    queryParams?: ParsedRouterRequest['request']['queryParams'];
    params?: ParsedRouterRequest['request']['params'];
  } = {},
): ParsedRouterRequest {
  return {
    request: {
      params: { schemaName: 'Article', text: 'hello', ...overrides.params },
      queryParams: overrides.queryParams ?? {},
      bodyParams: {},
      urlParams: {},
      path: '/search',
      headers: new Headers(),
      rawHeaders: [],
      rawBody: Buffer.alloc(0),
      context: overrides.context ?? { user: { _id: 'user-1' } },
      cookies: {},
    },
  };
}

describe('client semantic search route', () => {
  it('drops query userId and adminOperator, and body userId and scope', () => {
    const queryParams = CLIENT_SEMANTIC_SEARCH_ROUTE.queryParams;
    const bodyParams = CLIENT_SEMANTIC_SEARCH_ROUTE.bodyParams;
    assert.ok(queryParams);
    assert.ok(bodyParams);
    assert.deepEqual(Object.keys(queryParams), ['scope']);
    assert.equal('userId' in bodyParams, false);
    assert.equal('scope' in bodyParams, false);
    assert.equal('adminOperator' in bodyParams, false);
    assert.deepEqual(CLIENT_SEMANTIC_SEARCH_ROUTE.middlewares, ['authMiddleware']);

    const query = validateParams(
      { scope: 'Team:org', userId: 'attacker', adminOperator: 'true' },
      queryParams,
      { unknownKeys: 'strip', coerce: true },
    );
    assert.deepEqual(query, { scope: 'Team:org' });

    const body = validateParams(
      {
        schemaName: 'Article',
        text: 'hello',
        userId: 'attacker',
        scope: 'Team:body',
        adminOperator: true,
      },
      bodyParams,
      { unknownKeys: 'strip', coerce: false },
    );
    assert.equal(body.schemaName, 'Article');
    assert.equal(body.text, 'hello');
    assert.equal('userId' in body, false);
    assert.equal('scope' in body, false);
    assert.equal('adminOperator' in body, false);
  });

  it('uses the token user and query scope and ignores client subject fields', () => {
    const search = clientSearchCall(
      searchCall({
        context: { user: { _id: 'user-1' }, scope: 'Team:context' },
        queryParams: { scope: 'Team:org' },
        params: { userId: 'attacker', scope: 'Team:body', adminOperator: true },
      }),
    );
    assert.deepEqual(search.request, {
      schemaName: 'Article',
      text: 'hello',
      targetField: undefined,
      limit: undefined,
      filter: undefined,
      userId: 'user-1',
      scope: 'Team:org',
    });
    assert.equal('adminOperator' in search.request, false);
    assert.deepEqual(search.caller, { callerModule: 'router' });
    assert.equal(
      clientSearchCall(searchCall({ params: { filter: { tenantId: 'org-1' } } })).request
        .filter,
      '{"tenantId":"org-1"}',
    );
    assert.equal(
      clientSearchCall(searchCall({ params: { filter: '{"tenantId":"org-1"}' } })).request
        .filter,
      '{"tenantId":"org-1"}',
    );
  });

  it('rejects a request with no token user', () => {
    assert.throws(
      () =>
        clientSearchCall(
          searchCall({
            context: { scope: 'Team:org' },
            queryParams: { scope: 'Team:org' },
          }),
        ),
      (err: unknown) => err instanceof GrpcError && err.code === status.PERMISSION_DENIED,
    );
  });
});
