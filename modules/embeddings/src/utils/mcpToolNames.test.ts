import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConduitRouteActions } from '@conduitplatform/grpc-sdk';
import { ConduitNumber, ConduitString } from '@conduitplatform/module-tools';
import { embeddingsMcpToolName, embeddingsPublicPath } from './mcpToolNames.js';
import {
  CONFIG_BODY,
  EMBEDDINGS_ADMIN_ROUTES,
  EMBEDDINGS_CLIENT_FORBIDDEN_PATHS,
  EMBEDDINGS_CLIENT_SEARCH_PATH,
} from '../admin/routes.js';
import { EmbeddingsRoutes } from '../routes/index.js';

describe('embeddings MCP tool names', () => {
  it('mirrors Hermes route-to-tool naming after the module prefix', () => {
    assert.equal(embeddingsPublicPath('/configs'), '/embeddings/configs');
    assert.equal(
      embeddingsMcpToolName('GET', '/embeddings/configs'),
      'get_embeddings_configs',
    );
    assert.equal(
      embeddingsMcpToolName('POST', '/embeddings/backfills/id/cancel'),
      'post_embeddings_backfills_id_cancel',
    );
  });

  it('exposes operator /embeddings/* admin routes with descriptions and MCP names', () => {
    const names = EMBEDDINGS_ADMIN_ROUTES.map(route => route.mcpName);
    assert.deepEqual(names, [
      'get_embeddings_configs',
      'post_embeddings_configs',
      'get_embeddings_configs_id',
      'delete_embeddings_configs_id',
      'get_embeddings_capabilities',
      'get_embeddings_status',
      'get_embeddings_backfills',
      'post_embeddings_backfills',
      'get_embeddings_backfills_id',
      'post_embeddings_backfills_id_cancel',
      'post_embeddings_backfills_id_resume',
      'post_embeddings_search',
    ]);
    for (const route of EMBEDDINGS_ADMIN_ROUTES) {
      assert.equal(route.publicPath.startsWith('/embeddings/'), true);
      assert.equal(route.clientExposed, false);
      assert.equal(route.description.length > 20, true);
      assert.match(route.description, /Operator-only/);
      assert.equal(route.mcpName, embeddingsMcpToolName(route.action, route.publicPath));
    }
    assert.equal(
      EMBEDDINGS_ADMIN_ROUTES.some(
        route => route.path === '/backfills' && route.action === ConduitRouteActions.POST,
      ),
      true,
    );
  });

  it('never exposes config, backfill, capabilities, or status as client routes', () => {
    assert.deepEqual(EmbeddingsRoutes.clientForbiddenPaths(), [
      '/configs',
      '/backfills',
      '/capabilities',
      '/status',
    ]);
    for (const path of EMBEDDINGS_CLIENT_FORBIDDEN_PATHS) {
      assert.equal(
        EMBEDDINGS_ADMIN_ROUTES.some(
          route => route.path === path || route.path.startsWith(`${path}/`),
        ),
        true,
      );
    }
    assert.equal(EMBEDDINGS_CLIENT_SEARCH_PATH, '/search');
  });

  it('accepts optional catalogue fields on Admin config upsert', () => {
    assert.deepEqual(Object.keys(CONFIG_BODY), [
      'schemaName',
      'sourceFields',
      'targetField',
      'provider',
      'model',
      'dimensions',
      'similarity',
      'sourceFieldAllowlist',
      'enabled',
    ]);
    assert.equal(CONFIG_BODY.model, ConduitString.Optional);
    assert.equal(CONFIG_BODY.dimensions, ConduitNumber.Optional);
    assert.equal(CONFIG_BODY.provider, ConduitString.Optional);
  });
});
