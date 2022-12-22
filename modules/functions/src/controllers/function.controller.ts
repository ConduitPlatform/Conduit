import ConduitGrpcSdk, {
  ConduitRouteOptions,
  ConduitRouteReturnDefinition,
  GrpcError,
  GrpcServer,
  ParsedRouterRequest,
  RequestHandlers,
  RoutingManager,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { NodeVM } from 'vm2';
import { FunctionEndpoints } from '../models';
import { createFunctionRoute } from './utils';

export class FunctionController {
  private crudRoutes: {
    input: ConduitRouteOptions;
    returnType: ConduitRouteReturnDefinition;
    handler: RequestHandlers;
  }[] = [];
  private customRoutes: {
    input: ConduitRouteOptions;
    returnType: ConduitRouteReturnDefinition;
    handler: RequestHandlers;
  }[] = [];

  private _routingManager: RoutingManager;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this._routingManager = new RoutingManager(this.grpcSdk.router!, server);
    this.refreshRoutes();
  }

  refreshRoutes() {
    return FunctionEndpoints.getInstance()
      .findMany({})
      .then(r => {
        if (!r || r.length == 0) {
          ConduitGrpcSdk.Logger.log('No functions to register');
        }
        const routes: any[] = [];

        r.forEach(func => {
          routes.push(createFunctionRoute(func, this.executeFunction.bind(this)));
        });

        this.addRoutes(routes, false);
        this._routingManager.clear();
        this.crudRoutes.concat(this.customRoutes).forEach(route => {
          this._routingManager.route(route.input, route.returnType, route.handler);
        });
        this._routingManager
          .registerRoutes()
          .then(() => {
            ConduitGrpcSdk.Logger.log('Refreshed routes');
          })
          .catch((err: Error) => {
            ConduitGrpcSdk.Logger.error('Failed to register routes for module');
            ConduitGrpcSdk.Logger.error(err);
          });
      })
      .catch((err: Error) => {
        ConduitGrpcSdk.Logger.error(
          'Something went wrong when loading functions to the router',
        );
        ConduitGrpcSdk.Logger.error(err);
      });
  }

  addRoutes(
    routes: {
      input: ConduitRouteOptions;
      returnType: ConduitRouteReturnDefinition;
      handler: RequestHandlers;
    }[],
    crud: boolean = true,
  ) {
    if (crud) {
      this.crudRoutes = routes;
    } else {
      this.customRoutes = routes;
    }
  }

  async executeFunction(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const functionName = call.request.params.name;
    const terminationTime = call.request.params.timeout ?? 180000;

    const func = await FunctionEndpoints.getInstance().findOne({ name: functionName });
    if (isNil(func)) {
      throw new GrpcError(status.NOT_FOUND, 'Function does not exist');
    }

    const vm = new NodeVM({
      console: 'inherit',
      timeout: terminationTime,
    });
    try {
      const result = await vm.run(func.code);
      return { result };
    } catch (e) {
      throw new GrpcError(status.INTERNAL, 'Execution failed');
    }
  }
}
