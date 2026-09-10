import { ConduitRouteActions, TYPE } from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitJson,
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
  dimensions: ConduitNumber.Optional,
  similarity: ConduitString.Optional,
  sourceFieldAllowlist: { type: [TYPE.String], required: false },
  enabled: ConduitBoolean.Optional,
};

export const SOURCE_BODY = {
  id: ConduitString.Optional,
  label: ConduitString.Optional,
  kind: ConduitString.Required,
  partitionSubject: ConduitString.Required,
  provider: ConduitString.Optional,
  model: ConduitString.Optional,
  dimensions: ConduitNumber.Optional,
  similarity: ConduitString.Optional,
  selectors: ConduitJson.Optional,
  metadataAllowlist: { type: [TYPE.String], required: false },
};

export const UPDATE_SOURCE_BODY = {
  label: ConduitString.Optional,
  selectors: ConduitJson.Optional,
  metadataAllowlist: { type: [TYPE.String], required: false },
  syncCheckpoint: ConduitJson.Optional,
};

export const DOCUMENT_BODY = {
  externalDocumentId: ConduitString.Required,
  contentVersion: ConduitString.Optional,
  etag: ConduitString.Optional,
  metadata: ConduitJson.Optional,
  storageFileId: ConduitString.Optional,
  connectorReference: ConduitString.Optional,
  mimeType: ConduitString.Optional,
  chunks: { type: [TYPE.JSON], required: true },
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
    'Runs operator semantic search by schemaName or sourceId. Schema search requires query text. Source search accepts query text or a matching finite query vector. Operator-only; never hybrid.',
  ),
  contract(
    '/sources',
    ConduitRouteActions.GET,
    'Lists generic embedding sources. Operator-only. Filter by kind, state, or partitionSubject.',
  ),
  contract(
    '/sources',
    ConduitRouteActions.POST,
    'Creates a generic embedding source with an immutable kind, partition, and vector profile. Operator-only. Provisions a hidden profile-isolated chunk index. Never stores credentials or fetches references.',
  ),
  contract(
    '/sources/:id',
    ConduitRouteActions.GET,
    'Returns one generic embedding source by id. Operator-only.',
  ),
  contract(
    '/sources/:id',
    ConduitRouteActions.PATCH,
    'Updates mutable embedding source label, selectors, metadata allowlist, or sync checkpoint. Operator-only. Kind, partitionSubject, and vector profile stay immutable.',
  ),
  contract(
    '/sources/:id',
    ConduitRouteActions.DELETE,
    'Purges a generic embedding source and cascades relations, documents, and chunks. Operator-only.',
  ),
  contract(
    '/sources/:id/disable',
    ConduitRouteActions.POST,
    'Disables a generic embedding source. Operator-only. Ingest and search fail closed afterwards.',
  ),
  contract(
    '/sources/:id/revoke',
    ConduitRouteActions.POST,
    'Revokes a generic embedding source and deletes its ReBAC relations. Operator-only. Ingest and search fail closed afterwards.',
  ),
  contract(
    '/sources/:id/status',
    ConduitRouteActions.GET,
    'Returns embedding source readiness, per-document status counts, and Storage extraction queue visibility. Operator-only.',
  ),
  contract(
    '/sources/:id/reconcile',
    ConduitRouteActions.POST,
    'Reconciles a conduit-storage source against existing matching files and missed lifecycle events. Operator-only. Enqueues distinct Storage ingest and delete jobs.',
  ),
  contract(
    '/sources/:id/documents',
    ConduitRouteActions.POST,
    'Trusted document and chunk ingest. Operator-only. Accepts XOR bounded text or a precomputed finite exact-dimension vector. Embeds, hashes, and discards text. Idempotent on source, externalDocument, version, and chunk key.',
  ),
  contract(
    '/sources/:id/documents/:externalDocumentId',
    ConduitRouteActions.DELETE,
    'Deletes one embedding document and its chunks. Operator-only.',
  ),
];

export const EMBEDDINGS_CLIENT_SEARCH_PATH = '/search';
export const EMBEDDINGS_CLIENT_FORBIDDEN_PATHS = [
  '/configs',
  '/backfills',
  '/capabilities',
  '/status',
  '/sources',
];

export { CONFIG_BODY };
