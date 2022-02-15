import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  constructConduitRoute,
  GrpcServer,
  UnparsedRouterResponse,
  ConduitNumber,
  ParsedRouterRequest,
  GrpcError,
  ConduitJson,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { SequelizeSchema } from '../adapters/sequelize-adapter/SequelizeSchema';
import { MongooseSchema } from '../adapters/mongoose-adapter/MongooseSchema';
import { DatabaseAdapter } from '../adapters/DatabaseAdapter';

export class AdminHandlers {

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly _activeAdapter: DatabaseAdapter<MongooseSchema | SequelizeSchema>
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
        new ConduitRouteReturnDefinition('GetDeclaredSchemas', this._activeAdapter.models!['_DeclaredSchema'].originalSchema.fields),

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
          declaredSchemasExtensions: [ConduitJson.Required],
          count: ConduitNumber.Required,
        }),
        'getDeclaredSchemasExtensions',
      ),
    ];
  }

  async getDeclaredSchemas(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { skip } = call.request.params ?? 0;
    const { limit } = call.request.params ?? 25;
    const query = '{}'
    const schemaAdapter = this._activeAdapter.getSchemaModel('_DeclaredSchema');
    const declaredSchemasDocumentsPromise = schemaAdapter.model
      .findMany(
        query,
        undefined,
        skip,
        limit,
        undefined,
      );
    const totalCountPromise = schemaAdapter.model.countDocuments(query);

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
    const query = '{}';
    const schemaAdapter = this._activeAdapter.getSchemaModel('_DeclaredSchema');
    const declaredSchemasExtensionsPromise = schemaAdapter.model
      .findMany(
        query,
        skip,
        limit,
        'name extensions',
        undefined,
      );
    const totalCountPromise = schemaAdapter.model.countDocuments(query);

    const [declaredSchemasExtensions, totalCount] = await Promise.all([
      declaredSchemasExtensionsPromise,
      totalCountPromise,
    ]).catch((e: Error) => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
    return { declaredSchemasExtensions, totalCount };
  }

}
