import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  constructConduitRoute,
  GrpcServer,
  UnparsedRouterResponse,
  ConduitNumber,
  ParsedRouterRequest,
  GrpcError,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import { _DeclaredSchema } from '../models';
import { status } from '@grpc/grpc-js';

export class AdminHandlers {

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this.registerAdminRoutes();
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        getDeclaredSchemas: this.getDeclaredSchemas.bind(this),
        getDeclaredSchemasExtensions: this.getDeclaredSchemasExtensions.bind(this),
      })
      .catch((err: Error) => {
        console.log('Failed to register admin routes for module!');
        console.error(err);
      });
  }

  private getRegisteredRoutes(): any[] {
    return [
      // Schemas
      constructConduitRoute(
        {
          path: '/schemas',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetDeclaredSchemas', _DeclaredSchema.getInstance().fields),
        'getDeclaredSchemas',
      ),
      constructConduitRoute(
        {
          path: '/schemas/extensions',
          action: ConduitRouteActions.GET,
          queryParams: {
            skip: ConduitNumber.Optional,
            limit: ConduitNumber.Optional,
          },
        },
        new ConduitRouteReturnDefinition('GetDeclaredSchemasExtensions', {
          declaredSchemasExtensions: [TYPE.JSON], // Swagger parser inconsistency
          count: ConduitNumber.Required,
        }),
        'getDeclaredSchemasExtensions',
      ),
    ];
  }

  async getDeclaredSchemas(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: any = {};
    const declaredSchemasDocumentsPromise = _DeclaredSchema.getInstance()
      .findMany(
        query,
        undefined,
        skip,
        limit,
        undefined,
      );
    const totalCountPromise = _DeclaredSchema.getInstance().countDocuments(query);

    const [declaredSchemasDocuments, totalCount] = await Promise.all([
      declaredSchemasDocumentsPromise,
      totalCountPromise,
    ]).catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

    return { declaredSchemasDocuments, totalCount };
  }

  async getDeclaredSchemasExtensions(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: any = {};
    const declaredSchemasExtensionsPromise = _DeclaredSchema.getInstance()
      .findMany(
        query,
        'name extensions',
        skip,
        limit,
        undefined,
      );
    const totalCountPromise = _DeclaredSchema.getInstance().countDocuments(query);

    const [declaredSchemasExtensions, totalCount] = await Promise.all([
      declaredSchemasExtensionsPromise,
      totalCountPromise,
    ]).catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
    return { declaredSchemasExtensions, totalCount };
  }

}
