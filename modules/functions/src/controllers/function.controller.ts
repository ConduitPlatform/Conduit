import ConduitGrpcSdk, {
  ConduitRouteOptions,
  ConduitRouteReturnDefinition,
  GrpcServer,
  RequestHandlers,
  RoutingManager,
} from '@conduitplatform/grpc-sdk';
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
          routes.push(createFunctionRoute(func));
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
}
