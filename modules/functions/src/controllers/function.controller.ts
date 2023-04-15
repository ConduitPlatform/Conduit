import ConduitGrpcSdk, {
  ConduitRouteOptions,
  ConduitRouteReturnDefinition,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import {
  GrpcServer,
  RequestHandlers,
  RoutingManager,
} from '@conduitplatform/module-tools';

import { Functions } from '../models';
import { createFunctionRoute } from './utils';

export class FunctionController {
  private functionRoutes: {
    input: ConduitRouteOptions;
    returnType: ConduitRouteReturnDefinition;
    handler: RequestHandlers;
  }[] = [];

  private _routingManager: RoutingManager;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this._routingManager = new RoutingManager(this.grpcSdk.router!, server);
    this.refreshRoutes();
    this.initializeState();
  }

  initializeState() {
    this.grpcSdk.bus?.subscribe('functions', () => {
      this.refreshRoutes();
    });
  }

  refreshRoutes() {
    return Functions.getInstance()
      .findMany({})
      .then(r => {
        if (!r || r.length == 0) {
          ConduitGrpcSdk.Logger.log('No functions to register');
        }
        const routes: UntypedArray = [];

        r.forEach(func => {
          routes.push(createFunctionRoute(func, this.grpcSdk));
        });
        this.functionRoutes = routes;
        this._routingManager.clear();
        this.functionRoutes.forEach(route => {
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

  refreshEndpoints(): void {
    this.grpcSdk.bus?.publish('functions', '');
    this.refreshRoutes();
  }
}
