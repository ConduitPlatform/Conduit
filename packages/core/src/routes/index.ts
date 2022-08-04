import ConduitGrpcSdk, {
  // ConduitRouteActions as Actions,
  // ConduitRouteReturnDefinition,
  GrpcServer as ConduitGrpcServer,
  RoutingManager,
} from '@conduitplatform/grpc-sdk';

export class HttpServer {
  private _routingManager: RoutingManager;
  constructor() {}

  initialize(grpcSdk: ConduitGrpcSdk, server: ConduitGrpcServer) {
    this._routingManager = new RoutingManager(grpcSdk.router!, server);
    this.registerRoutes();
  }

  private registerRoutes() {
    // this._routingManager.route(
    //   ...
    // );
    this._routingManager.registerRoutes().catch(() => {});
  }
}
