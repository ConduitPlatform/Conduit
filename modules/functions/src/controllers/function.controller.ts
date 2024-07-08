import {
  ConduitGrpcSdk,
  ConduitMiddlewareOptions,
  ConduitRouteOptions,
  ConduitRouteReturnDefinition,
  ConduitSocketEventHandler,
  ConduitSocketOptions,
} from '@conduitplatform/grpc-sdk';
import {
  GrpcServer,
  RequestHandlers,
  RoutingManager,
} from '@conduitplatform/module-tools';

import { Functions } from '../models/index.js';
import { createFunctionRoute } from './utils.js';

type Socket = {
  input: ConduitSocketOptions;
  events: Record<string, ConduitSocketEventHandler>;
};
type Route = {
  input: ConduitRouteOptions;
  type: ConduitRouteReturnDefinition;
  handler: RequestHandlers;
  returnType: ConduitRouteReturnDefinition;
};
type Middleware = {
  input: ConduitMiddlewareOptions;
  handler: RequestHandlers;
};
export class FunctionController {
  private functionRoutes: (Route | Socket | Middleware)[] = [];

  private _routingManager: RoutingManager;

  constructor(
    readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
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
        this.functionRoutes = [];

        r.forEach(func => {
          const route = createFunctionRoute(func, this.grpcSdk);
          if (route) {
            this.functionRoutes.push(route as any);
          }
        });
        this._routingManager.clear();
        this.functionRoutes.forEach(route => {
          if ((route as Socket).events) {
            this._routingManager.socket(
              (route as Socket).input,
              (route as Socket).events,
            );
          } else if (!(route as Middleware).hasOwnProperty('returnType')) {
            this._routingManager.middleware(
              (route as Middleware).input,
              (route as Middleware).handler,
            );
          } else {
            this._routingManager.route(
              (route as Route).input,
              (route as Route).returnType,
              (route as Route).handler,
            );
          }
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
