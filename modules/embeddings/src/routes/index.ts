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
  assertClientSearchSubject,
  clampClientSearchLimit,
  clientSearchSubject,
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
    const subject = assertClientSearchSubject(clientSearchSubject(call.request.context));
    const filter = call.request.params.filter;
    const result = await this.api.semanticSearch(
      {
        schemaName: call.request.params.schemaName,
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
        scope: subject.scope,
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
          'Client semantic search by text. User and scope are taken from the authenticated router context; raw vectors, userId, scope, and adminOperator are not accepted. Client limit is capped below the admin/gRPC vector-search maximum.',
        bodyParams: {
          schemaName: ConduitString.Required,
          text: ConduitString.Required,
          targetField: ConduitString.Optional,
          filter: ConduitJson.Optional,
          limit: ConduitNumber.Optional,
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
