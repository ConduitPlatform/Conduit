import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
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
import { CONFIG_BODY, EMBEDDINGS_ADMIN_ROUTES } from './routes.js';

const ADMIN_CALLER = { platformAdmin: true as const };

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
      dimensions: number;
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
        text: call.request.params.text,
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
          schemaName: ConduitString.Required,
          text: ConduitString.Required,
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
    void this.routingManager.registerRoutes();
  }
}
