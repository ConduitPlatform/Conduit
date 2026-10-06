import {
  ConduitRouteActions,
  TYPE,
  type ConduitNumberValidation,
} from '@conduitplatform/grpc-sdk';
import { ConduitNumber, ConduitString } from '@conduitplatform/module-tools';
import {
  DEFAULT_BACKFILL_BATCH_SIZE,
  MAX_BACKFILL_BATCH_SIZE,
  MIN_BACKFILL_BATCH_SIZE,
} from '../utils/backfillRun.js';
import { CLIENT_SEMANTIC_SEARCH_MAX_LIMIT } from '../utils/clientSearchContext.js';
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
  sourceFields: {
    type: [TYPE.String],
    required: true,
    description:
      'Schema fields concatenated into embedding input. At least one field. Changing sourceFields does not recreate the vector index.',
    validate: { minItems: 1 },
  },
  targetField: ConduitString.Required,
  provider: ConduitString.Optional,
  model: ConduitString.Optional,
  dimensions: ConduitNumber.Optional,
  similarity: {
    type: TYPE.String,
    required: false,
    description:
      'Vector similarity. One of: cosine, euclidean, dotProduct. Defaults to cosine. Changing similarity recreates the vector index.',
    validate: {
      pattern: '^(cosine|euclidean|dotProduct)$',
      message: 'similarity must be cosine, euclidean, or dotProduct',
    },
  },
  sourceFieldAllowlist: { type: [TYPE.String], required: false },
  enabled: {
    type: TYPE.Boolean,
    required: false,
    description:
      'Leave false on first upsert until Database reports a queryable index and convict enabled is true. enabled=true while convict is false fails closed. After convict is true, enabled=true while the index is pending stores the config disabled.',
  },
};

const describedOptionalJson = (
  description: string,
): { type: TYPE.JSON; required: false; description: string } => ({
  type: TYPE.JSON,
  required: false,
  description,
});

const describedOptionalNumber = (
  description: string,
  validate: ConduitNumberValidation,
): {
  type: TYPE.Number;
  required: false;
  description: string;
  validate: ConduitNumberValidation;
} => ({
  type: TYPE.Number,
  required: false,
  description,
  validate,
});

const describedOptionalBoolean = (
  description: string,
): { type: TYPE.Boolean; required: false; description: string } => ({
  type: TYPE.Boolean,
  required: false,
  description,
});

const BACKFILL_BODY = {
  schemaName: ConduitString.Required,
  batchSize: describedOptionalNumber(
    `Documents scanned per backfill page. Integer ${MIN_BACKFILL_BATCH_SIZE}-${MAX_BACKFILL_BATCH_SIZE} (also capped by queue.maxBatchSize). Default ${DEFAULT_BACKFILL_BATCH_SIZE}. Never scans in the request thread.`,
    {
      min: MIN_BACKFILL_BATCH_SIZE,
      max: MAX_BACKFILL_BATCH_SIZE,
      integer: true,
    },
  ),
  configId: ConduitString.Optional,
  onlyMissing: describedOptionalBoolean(
    'When true, only documents missing the target vector are queued. Prefer this for bounded catch-up after enabling a config.',
  ),
  filter: describedOptionalJson(
    'Optional document filter. Equality, comparisons, bounded $in/$nin, and $and only. Regex, $or, $not, and $like are rejected.',
  ),
};

const SEARCH_BODY = {
  schemaName: ConduitString.Required,
  text: ConduitString.Required,
  targetField: ConduitString.Optional,
  filter: describedOptionalJson(
    'Optional Database vector-search filter. JSON object; not a raw vector.',
  ),
  limit: describedOptionalNumber(
    `Maximum hits to return. Admin/MCP is not capped here. Client POST /embeddings/search caps at ${CLIENT_SEMANTIC_SEARCH_MAX_LIMIT}.`,
    { min: 1, integer: true },
  ),
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
    'Returns embeddings module readiness, provider/index warnings, and generation/backfill queue counts. Operator-only. ready is false while convict enabled is false.',
  ),
  contract(
    '/backfills',
    ConduitRouteActions.GET,
    'Lists persisted BackfillRun records with scanned/queued/processed/failed counts, cursor, onlyMissing, and state. Operator-only. Optional query params: schemaName, state, configId, skip, limit.',
  ),
  contract(
    '/backfills',
    ConduitRouteActions.POST,
    'Starts a queued cursor-based backfill. Operator-only. Supports onlyMissing, configId, and bounded batchSize. Fails closed while convict enabled is false. Never scans in the request thread.',
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
    'Resumes a failed or canceled BackfillRun from its persisted cursor. Operator-only. Re-checks capability and index readiness. Fails closed while convict enabled is false.',
  ),
  contract(
    '/search',
    ConduitRouteActions.POST,
    'Runs operator semantic search by text. Generates a query embedding and delegates vector search to Database. Operator-only; does not accept raw vectors. Fails closed while convict enabled is false.',
  ),
];

export const EMBEDDINGS_CLIENT_SEARCH_PATH = '/search';
export const EMBEDDINGS_CLIENT_FORBIDDEN_PATHS = [
  '/configs',
  '/backfills',
  '/capabilities',
  '/status',
];

export { CONFIG_BODY, BACKFILL_BODY, SEARCH_BODY };
