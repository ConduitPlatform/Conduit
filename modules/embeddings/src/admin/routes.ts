import { ConduitRouteActions, TYPE } from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitNumber,
  ConduitString,
} from '@conduitplatform/module-tools';
import { embeddingsMcpToolName, embeddingsPublicPath } from '../utils/mcpToolNames.js';

export interface EmbeddingsAdminRouteContract {
  path: string;
  action: ConduitRouteActions;
  description: string;
  publicPath: string;
  mcpName: string;
  clientExposed: false;
}

const CONFIG_BODY = {
  schemaName: ConduitString.Required,
  sourceFields: { type: [TYPE.String], required: true },
  targetField: ConduitString.Required,
  provider: ConduitString.Optional,
  model: ConduitString.Optional,
  dimensions: ConduitNumber.Required,
  similarity: ConduitString.Optional,
  sourceFieldAllowlist: { type: [TYPE.String], required: false },
  enabled: ConduitBoolean.Optional,
};

function contract(
  path: string,
  action: ConduitRouteActions,
  description: string,
): EmbeddingsAdminRouteContract {
  const publicPath = embeddingsPublicPath(path);
  return {
    path,
    action,
    description,
    publicPath,
    mcpName: embeddingsMcpToolName(action, publicPath),
    clientExposed: false,
  };
}

export const EMBEDDINGS_ADMIN_ROUTES: EmbeddingsAdminRouteContract[] = [
  contract(
    '/configs',
    ConduitRouteActions.GET,
    'Lists embedding configurations. Operator-only. Filter by schemaName or id. Never expose this as a client route.',
  ),
  contract(
    '/configs',
    ConduitRouteActions.POST,
    'Creates or updates an embedding config for a schema. Operator-only. The first upsert provisions the vector index when Database indexing is available. Saving enabled=true while the index is pending, or if provisioning fails, stores the config disabled until it is queryable. If indexing is unavailable, status reports a manual index lifecycle warning. Caller-supplied sourceFieldAllowlist is honored only for platform-admin upserts; schema-owner gRPC callers use operator config allowlists.',
  ),
  contract(
    '/configs/:id',
    ConduitRouteActions.GET,
    'Returns one embedding configuration by id. Operator-only.',
  ),
  contract(
    '/configs/:id',
    ConduitRouteActions.DELETE,
    'Deletes an embedding configuration by id. Operator-only. Does not drop vector fields or indexes.',
  ),
  contract(
    '/capabilities',
    ConduitRouteActions.GET,
    'Returns Database vector storage, index, and search capabilities plus readiness warnings. Operator-only.',
  ),
  contract(
    '/status',
    ConduitRouteActions.GET,
    'Returns embeddings module readiness, provider/index warnings, and generation/backfill queue counts. Operator-only.',
  ),
  contract(
    '/backfills',
    ConduitRouteActions.GET,
    'Lists persisted BackfillRun records with scanned/queued/processed/failed counts, cursor, onlyMissing, and state. Operator-only.',
  ),
  contract(
    '/backfills',
    ConduitRouteActions.POST,
    'Starts a queued cursor-based backfill. Operator-only. Supports onlyMissing, configId, and bounded batchSize. Never scans in the request thread.',
  ),
  contract(
    '/backfills/:id',
    ConduitRouteActions.GET,
    'Returns one persisted BackfillRun including counts, cursor, onlyMissing, and sanitized error. Operator-only.',
  ),
  contract(
    '/backfills/:id/cancel',
    ConduitRouteActions.POST,
    'Cancels a queued or running BackfillRun. Operator-only.',
  ),
  contract(
    '/backfills/:id/resume',
    ConduitRouteActions.POST,
    'Resumes a failed or canceled BackfillRun from its persisted cursor. Operator-only. Re-checks capability and index readiness.',
  ),
  contract(
    '/search',
    ConduitRouteActions.POST,
    'Runs operator semantic search by text. Generates a query embedding and delegates vector search to Database. Operator-only; does not accept raw vectors.',
  ),
];

export const EMBEDDINGS_CLIENT_SEARCH_PATH = '/search';
export const EMBEDDINGS_CLIENT_FORBIDDEN_PATHS = [
  '/configs',
  '/backfills',
  '/capabilities',
  '/status',
];

export { CONFIG_BODY };
