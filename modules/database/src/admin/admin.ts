import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  constructConduitRoute,
  GrpcServer,
  UnparsedRouterResponse, 
  ConduitNumber, 
  ParsedRouterRequest, 
  GrpcError,
} from '@quintessential-sft/conduit-grpc-sdk';
import { DeclaredSchema } from '../models';
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
        new ConduitRouteReturnDefinition('GetDeclaredSchemas', DeclaredSchema.getInstance().fields),
        'getDeclaredSchemas',
      ),
    ];
  }

  async getDeclaredSchemas(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    let query: any = {};
    const declaredSchemasDocumentsPromise = DeclaredSchema.getInstance()
      .findMany(
        query,
        undefined,
        skip,
        limit,
        undefined,
      );
    const totalCountPromise = DeclaredSchema.getInstance().countDocuments(query);

    const [DeclaredSchemasDocuments, totalCount] = await Promise.all([
      declaredSchemasDocumentsPromise,
      totalCountPromise,
    ]).catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });

    return { DeclaredSchemasDocuments, totalCount };
  }
}
