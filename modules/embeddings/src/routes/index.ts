import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitJson,
  ConduitNumber,
  ConduitString,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { EmbeddingsApi } from '../api/embeddingsApi.js';
import { EMBEDDINGS_CLIENT_FORBIDDEN_PATHS } from '../admin/routes.js';
import {
  assertClientSearchOverrides,
  assertClientSearchSubject,
  clampClientSearchLimit,
  clientSearchSubject,
  resolveClientSearchScope,
} from '../utils/clientSearchContext.js';

export class EmbeddingsRoutes {
  private readonly routingManager: RoutingManager;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly api: EmbeddingsApi,
  ) {
    this.routingManager = new RoutingManager(this.grpcSdk.router!, this.server);
  }

  static clientForbiddenPaths(): string[] {
    return [...EMBEDDINGS_CLIENT_FORBIDDEN_PATHS];
  }

  async semanticSearch(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    assertClientSearchOverrides(call.request.params as Record<string, unknown>);
    const subject = assertClientSearchSubject(clientSearchSubject(call.request.context));
    const filter = call.request.params.filter;
    const result = await this.api.semanticSearch(
      {
        schemaName: call.request.params.schemaName,
        sourceId: call.request.params.sourceId,
        text: call.request.params.text,
        targetField: call.request.params.targetField,
        limit: clampClientSearchLimit(call.request.params.limit),
        filter:
          filter == null
            ? undefined
            : typeof filter === 'string'
              ? filter
              : JSON.stringify(filter),
        userId: subject.userId,
        scope: resolveClientSearchScope({
          contextScope: subject.scope,
          requestScope: call.request.params.scope,
        }),
      },
      { callerModule: 'router' },
    );
    return {
      hits: result.hits.map(hit => ({
        ...hit,
        document: JSON.parse(hit.document),
      })),
    };
  }

  async registerRoutes() {
    this.routingManager.clear();
    this.routingManager.route(
      {
        path: '/search',
        action: ConduitRouteActions.POST,
        description:
          'Client semantic search by schemaName or sourceId. Query text only. User comes from the authenticated router context; optional CMS-style scope is validated. Raw vectors, userId, adminOperator, and partition overrides are rejected. Client limit is capped below the admin/gRPC maximum.',
        bodyParams: {
          schemaName: ConduitString.Optional,
          sourceId: ConduitString.Optional,
          text: ConduitString.Required,
          targetField: ConduitString.Optional,
          filter: ConduitJson.Optional,
          limit: ConduitNumber.Optional,
          scope: ConduitString.Optional,
        },
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('ClientSemanticSearch', {
        hits: [ConduitJson.Required],
      }),
      this.semanticSearch.bind(this),
    );
    await this.routingManager.registerRoutes();
  }
}
