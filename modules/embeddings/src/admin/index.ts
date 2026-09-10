import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  TYPE,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitJson,
  ConduitNumber,
  ConduitString,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { EmbeddingsApi } from '../api/embeddingsApi.js';
import {
  CONFIG_BODY,
  DOCUMENT_BODY,
  EMBEDDINGS_ADMIN_ROUTES,
  SOURCE_BODY,
  UPDATE_SOURCE_BODY,
} from './routes.js';
import { status } from '@grpc/grpc-js';

const ADMIN_CALLER = { platformAdmin: true as const };

function asJsonString(value: unknown): string | undefined {
  if (value == null) return undefined;
  return typeof value === 'string' ? value : JSON.stringify(value);
}

export class AdminHandlers {
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly api: EmbeddingsApi,
  ) {
    this.routingManager = new RoutingManager(this.grpcSdk.admin, this.server);
    this.registerAdminRoutes();
  }

  async listConfigs(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.api.getConfigs(
      {
        schemaName: call.request.params.schemaName,
        id: call.request.params.id,
      },
      ADMIN_CALLER,
    );
  }

  async getConfig(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const result = await this.api.getConfigs(
      { id: call.request.params.id },
      ADMIN_CALLER,
    );
    return result.configs[0];
  }

  async upsertConfig(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = call.request.params as {
      schemaName: string;
      sourceFields: string[];
      targetField: string;
      provider?: string;
      model?: string;
      dimensions?: number;
      similarity?: string;
      sourceFieldAllowlist?: string[];
      enabled?: boolean;
    };
    return this.api.upsertConfig(params, ADMIN_CALLER);
  }

  async deleteConfig(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.api.deleteConfig({ id: call.request.params.id }, ADMIN_CALLER);
  }

  async getCapabilities(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.api.getCapabilities(call.request.params.schemaName);
  }

  async getStatus(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.api.getStatus(call.request.params.schemaName);
  }

  async listBackfills(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.api.listBackfills(
      {
        schemaName: call.request.params.schemaName,
        state: call.request.params.state,
        configId: call.request.params.configId,
        skip: call.request.params.skip,
        limit: call.request.params.limit,
      },
      ADMIN_CALLER,
    );
  }

  async startBackfill(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const filter = call.request.params.filter;
    return this.api.startBackfill(
      {
        schemaName: call.request.params.schemaName,
        batchSize: call.request.params.batchSize,
        configId: call.request.params.configId,
        onlyMissing: call.request.params.onlyMissing,
        filter:
          filter == null
            ? undefined
            : typeof filter === 'string'
              ? filter
              : JSON.stringify(filter),
      },
      ADMIN_CALLER,
    );
  }

  async getBackfill(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.api.getBackfill(call.request.params.id, ADMIN_CALLER);
  }

  async cancelBackfill(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.api.cancelBackfill(call.request.params.id, ADMIN_CALLER);
  }

  async resumeBackfill(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.api.resumeBackfill(call.request.params.id, ADMIN_CALLER);
  }

  async semanticSearch(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const filter = call.request.params.filter;
    const result = await this.api.semanticSearch(
      {
        schemaName: call.request.params.schemaName,
        sourceId: call.request.params.sourceId,
        text: call.request.params.text,
        queryVector: call.request.params.queryVector,
        targetField: call.request.params.targetField,
        limit: call.request.params.limit,
        filter:
          filter == null
            ? undefined
            : typeof filter === 'string'
              ? filter
              : JSON.stringify(filter),
        adminOperator: true,
      },
      ADMIN_CALLER,
    );
    return {
      hits: result.hits.map(hit => ({
        ...hit,
        document: JSON.parse(hit.document),
      })),
    };
  }

  async listSources(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.requireGeneric().getSources(
      {
        kind: call.request.params.kind,
        state: call.request.params.state,
        partitionSubject: call.request.params.partitionSubject,
        skip: call.request.params.skip,
        limit: call.request.params.limit,
      },
      ADMIN_CALLER,
    );
  }

  async upsertSource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = call.request.params;
    return this.requireGeneric().upsertSource(
      {
        id: params.id,
        label: params.label,
        kind: params.kind,
        partitionSubject: params.partitionSubject,
        provider: params.provider,
        model: params.model,
        dimensions: params.dimensions,
        similarity: params.similarity,
        selectors: asJsonString(params.selectors),
        metadataAllowlist: params.metadataAllowlist,
      },
      ADMIN_CALLER,
    );
  }

  async getSource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.requireGeneric().getSource(call.request.params.id, ADMIN_CALLER);
  }

  async updateSource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = call.request.params;
    return this.requireGeneric().updateSource(
      {
        id: params.id,
        label: params.label,
        selectors: asJsonString(params.selectors),
        metadataAllowlist: params.metadataAllowlist,
        syncCheckpoint: asJsonString(params.syncCheckpoint),
      },
      ADMIN_CALLER,
    );
  }

  async getSourceStatus(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.requireGeneric().getSourceStatus(call.request.params.id, ADMIN_CALLER);
  }

  async reconcileSource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.api.reconcileSource(call.request.params.id, ADMIN_CALLER);
  }

  async disableSource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.requireGeneric().disableSource(call.request.params.id, ADMIN_CALLER);
  }

  async enableSource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.requireGeneric().enableSource(call.request.params.id, ADMIN_CALLER);
  }

  async revokeSource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.requireGeneric().revokeSource(call.request.params.id, ADMIN_CALLER);
  }

  async purgeSource(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.requireGeneric().purgeSource(call.request.params.id, ADMIN_CALLER);
  }

  async syncDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = call.request.params;
    return this.requireGeneric().syncDocument(
      {
        sourceId: params.id,
        externalDocumentId: params.externalDocumentId,
        contentVersion: params.contentVersion,
        etag: params.etag,
        metadata: asJsonString(params.metadata),
        storageFileId: params.storageFileId,
        connectorReference: params.connectorReference,
        mimeType: params.mimeType,
        chunks: params.chunks ?? [],
      },
      ADMIN_CALLER,
    );
  }

  async deleteDocument(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return this.requireGeneric().deleteDocument(
      {
        sourceId: call.request.params.id,
        externalDocumentId: call.request.params.externalDocumentId,
      },
      ADMIN_CALLER,
    );
  }

  private requireGeneric() {
    if (!this.api.generic) {
      throw new GrpcError(
        status.FAILED_PRECONDITION,
        'Generic embedding sources are not configured',
      );
    }
    return this.api.generic;
  }

  private registerAdminRoutes() {
    this.routingManager.clear();
    const descriptions = new Map(
      EMBEDDINGS_ADMIN_ROUTES.map(route => [
        `${route.action}:${route.path}`,
        route.description,
      ]),
    );
    this.routingManager.route(
      {
        path: '/configs',
        action: ConduitRouteActions.GET,
        description: descriptions.get(`${ConduitRouteActions.GET}:/configs`),
        queryParams: {
          schemaName: ConduitString.Optional,
          id: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetEmbeddingConfigs', {
        configs: [ConduitJson.Required],
      }),
      this.listConfigs.bind(this),
    );
    this.routingManager.route(
      {
        path: '/configs',
        action: ConduitRouteActions.POST,
        description: descriptions.get(`${ConduitRouteActions.POST}:/configs`),
        bodyParams: CONFIG_BODY as never,
      },
      new ConduitRouteReturnDefinition('UpsertEmbeddingConfig', {
        config: ConduitJson.Required,
        warnings: [ConduitString.Required],
      }),
      this.upsertConfig.bind(this),
    );
    this.routingManager.route(
      {
        path: '/configs/:id',
        action: ConduitRouteActions.GET,
        description: descriptions.get(`${ConduitRouteActions.GET}:/configs/:id`),
        urlParams: { id: ConduitString.Required },
      },
      new ConduitRouteReturnDefinition('GetEmbeddingConfig', TYPE.JSON),
      this.getConfig.bind(this),
    );
    this.routingManager.route(
      {
        path: '/configs/:id',
        action: ConduitRouteActions.DELETE,
        description: descriptions.get(`${ConduitRouteActions.DELETE}:/configs/:id`),
        urlParams: { id: ConduitString.Required },
      },
      new ConduitRouteReturnDefinition('DeleteEmbeddingConfig', {
        config: ConduitJson.Required,
      }),
      this.deleteConfig.bind(this),
    );
    this.routingManager.route(
      {
        path: '/capabilities',
        action: ConduitRouteActions.GET,
        description: descriptions.get(`${ConduitRouteActions.GET}:/capabilities`),
        queryParams: { schemaName: ConduitString.Optional },
      },
      new ConduitRouteReturnDefinition('GetEmbeddingCapabilities', {
        capabilities: ConduitJson.Required,
        warnings: [ConduitString.Required],
      }),
      this.getCapabilities.bind(this),
    );
    this.routingManager.route(
      {
        path: '/status',
        action: ConduitRouteActions.GET,
        description: descriptions.get(`${ConduitRouteActions.GET}:/status`),
        queryParams: { schemaName: ConduitString.Optional },
      },
      new ConduitRouteReturnDefinition('GetEmbeddingStatus', {
        enabled: ConduitBoolean.Required,
        ready: ConduitBoolean.Required,
        capabilities: ConduitJson.Required,
        generationQueue: ConduitJson.Required,
        backfillQueue: ConduitJson.Required,
        storageQueue: ConduitJson.Required,
        warnings: [ConduitString.Required],
      }),
      this.getStatus.bind(this),
    );
    this.routingManager.route(
      {
        path: '/backfills',
        action: ConduitRouteActions.GET,
        description: descriptions.get(`${ConduitRouteActions.GET}:/backfills`),
        queryParams: {
          schemaName: ConduitString.Optional,
          state: ConduitString.Optional,
          configId: ConduitString.Optional,
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
        },
      },
      new ConduitRouteReturnDefinition('ListEmbeddingBackfills', {
        runs: [ConduitJson.Required],
        count: ConduitNumber.Required,
      }),
      this.listBackfills.bind(this),
    );
    this.routingManager.route(
      {
        path: '/backfills',
        action: ConduitRouteActions.POST,
        description: descriptions.get(`${ConduitRouteActions.POST}:/backfills`),
        bodyParams: {
          schemaName: ConduitString.Required,
          batchSize: ConduitNumber.Optional,
          configId: ConduitString.Optional,
          onlyMissing: ConduitBoolean.Optional,
          filter: ConduitJson.Optional,
        },
      },
      new ConduitRouteReturnDefinition('StartEmbeddingBackfill', {
        queued: ConduitNumber.Required,
        runs: [ConduitJson.Required],
        warnings: [ConduitString.Required],
      }),
      this.startBackfill.bind(this),
    );
    this.routingManager.route(
      {
        path: '/backfills/:id',
        action: ConduitRouteActions.GET,
        description: descriptions.get(`${ConduitRouteActions.GET}:/backfills/:id`),
        urlParams: { id: ConduitString.Required },
      },
      new ConduitRouteReturnDefinition('GetEmbeddingBackfill', TYPE.JSON),
      this.getBackfill.bind(this),
    );
    this.routingManager.route(
      {
        path: '/backfills/:id/cancel',
        action: ConduitRouteActions.POST,
        description: descriptions.get(
          `${ConduitRouteActions.POST}:/backfills/:id/cancel`,
        ),
        urlParams: { id: ConduitString.Required },
      },
      new ConduitRouteReturnDefinition('CancelEmbeddingBackfill', {
        run: ConduitJson.Required,
      }),
      this.cancelBackfill.bind(this),
    );
    this.routingManager.route(
      {
        path: '/backfills/:id/resume',
        action: ConduitRouteActions.POST,
        description: descriptions.get(
          `${ConduitRouteActions.POST}:/backfills/:id/resume`,
        ),
        urlParams: { id: ConduitString.Required },
      },
      new ConduitRouteReturnDefinition('ResumeEmbeddingBackfill', {
        run: ConduitJson.Required,
      }),
      this.resumeBackfill.bind(this),
    );
    this.routingManager.route(
      {
        path: '/search',
        action: ConduitRouteActions.POST,
        description: descriptions.get(`${ConduitRouteActions.POST}:/search`),
        bodyParams: {
          schemaName: ConduitString.Optional,
          sourceId: ConduitString.Optional,
          text: ConduitString.Optional,
          queryVector: { type: [TYPE.Number], required: false },
          targetField: ConduitString.Optional,
          filter: ConduitJson.Optional,
          limit: ConduitNumber.Optional,
        },
      },
      new ConduitRouteReturnDefinition('AdminSemanticSearch', {
        hits: [ConduitJson.Required],
      }),
      this.semanticSearch.bind(this),
    );
    this.routingManager.route(
      {
        path: '/sources',
        action: ConduitRouteActions.GET,
        description: descriptions.get(`${ConduitRouteActions.GET}:/sources`),
        queryParams: {
          kind: ConduitString.Optional,
          state: ConduitString.Optional,
          partitionSubject: ConduitString.Optional,
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GetEmbeddingSources', {
        sources: [ConduitJson.Required],
        count: ConduitNumber.Required,
      }),
      this.listSources.bind(this),
    );
    this.routingManager.route(
      {
        path: '/sources',
        action: ConduitRouteActions.POST,
        description: descriptions.get(`${ConduitRouteActions.POST}:/sources`),
        bodyParams: SOURCE_BODY as never,
      },
      new ConduitRouteReturnDefinition('UpsertEmbeddingSource', {
        source: ConduitJson.Required,
        warnings: [ConduitString.Required],
      }),
      this.upsertSource.bind(this),
    );
    this.routingManager.route(
      {
        path: '/sources/:id',
        action: ConduitRouteActions.GET,
        description: descriptions.get(`${ConduitRouteActions.GET}:/sources/:id`),
        urlParams: { id: ConduitString.Required },
      },
      new ConduitRouteReturnDefinition('GetEmbeddingSource', TYPE.JSON),
      this.getSource.bind(this),
    );
    this.routingManager.route(
      {
        path: '/sources/:id',
        action: ConduitRouteActions.PATCH,
        description: descriptions.get(`${ConduitRouteActions.PATCH}:/sources/:id`),
        urlParams: { id: ConduitString.Required },
        bodyParams: UPDATE_SOURCE_BODY as never,
      },
      new ConduitRouteReturnDefinition('UpdateEmbeddingSource', {
        source: ConduitJson.Required,
        warnings: [ConduitString.Required],
      }),
      this.updateSource.bind(this),
    );
    this.routingManager.route(
      {
        path: '/sources/:id',
        action: ConduitRouteActions.DELETE,
        description: descriptions.get(`${ConduitRouteActions.DELETE}:/sources/:id`),
        urlParams: { id: ConduitString.Required },
      },
      new ConduitRouteReturnDefinition('PurgeEmbeddingSource', {
        source: ConduitJson.Required,
        deletedDocuments: ConduitNumber.Required,
        deletedChunks: ConduitNumber.Required,
      }),
      this.purgeSource.bind(this),
    );
    this.routingManager.route(
      {
        path: '/sources/:id/disable',
        action: ConduitRouteActions.POST,
        description: descriptions.get(`${ConduitRouteActions.POST}:/sources/:id/disable`),
        urlParams: { id: ConduitString.Required },
      },
      new ConduitRouteReturnDefinition('DisableEmbeddingSource', TYPE.JSON),
      this.disableSource.bind(this),
    );
    this.routingManager.route(
      {
        path: '/sources/:id/enable',
        action: ConduitRouteActions.POST,
        description: descriptions.get(`${ConduitRouteActions.POST}:/sources/:id/enable`),
        urlParams: { id: ConduitString.Required },
      },
      new ConduitRouteReturnDefinition('EnableEmbeddingSource', {
        source: ConduitJson.Required,
        warnings: [ConduitString.Required],
      }),
      this.enableSource.bind(this),
    );
    this.routingManager.route(
      {
        path: '/sources/:id/revoke',
        action: ConduitRouteActions.POST,
        description: descriptions.get(`${ConduitRouteActions.POST}:/sources/:id/revoke`),
        urlParams: { id: ConduitString.Required },
      },
      new ConduitRouteReturnDefinition('RevokeEmbeddingSource', TYPE.JSON),
      this.revokeSource.bind(this),
    );
    this.routingManager.route(
      {
        path: '/sources/:id/status',
        action: ConduitRouteActions.GET,
        description: descriptions.get(`${ConduitRouteActions.GET}:/sources/:id/status`),
        urlParams: { id: ConduitString.Required },
      },
      new ConduitRouteReturnDefinition('GetEmbeddingSourceStatus', TYPE.JSON),
      this.getSourceStatus.bind(this),
    );
    this.routingManager.route(
      {
        path: '/sources/:id/reconcile',
        action: ConduitRouteActions.POST,
        description: descriptions.get(
          `${ConduitRouteActions.POST}:/sources/:id/reconcile`,
        ),
        urlParams: { id: ConduitString.Required },
      },
      new ConduitRouteReturnDefinition('ReconcileEmbeddingSource', {
        queued: ConduitNumber.Required,
        scanned: ConduitNumber.Required,
        warnings: [ConduitString.Required],
      }),
      this.reconcileSource.bind(this),
    );
    this.routingManager.route(
      {
        path: '/sources/:id/documents',
        action: ConduitRouteActions.POST,
        description: descriptions.get(
          `${ConduitRouteActions.POST}:/sources/:id/documents`,
        ),
        urlParams: { id: ConduitString.Required },
        bodyParams: DOCUMENT_BODY as never,
      },
      new ConduitRouteReturnDefinition('SyncEmbeddingDocument', TYPE.JSON),
      this.syncDocument.bind(this),
    );
    this.routingManager.route(
      {
        path: '/sources/:id/documents/:externalDocumentId',
        action: ConduitRouteActions.DELETE,
        description: descriptions.get(
          `${ConduitRouteActions.DELETE}:/sources/:id/documents/:externalDocumentId`,
        ),
        urlParams: {
          id: ConduitString.Required,
          externalDocumentId: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('DeleteEmbeddingDocument', {
        documentId: ConduitString.Required,
        deletedChunks: ConduitNumber.Required,
      }),
      this.deleteDocument.bind(this),
    );
    void this.routingManager.registerRoutes();
  }
}
