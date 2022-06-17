import ConduitGrpcSdk, {
  ConduitRouteActions as Actions,
  ConduitRouteReturnDefinition,
  GrpcError,
  GrpcServer as ConduitGrpcServer,
  RoutingManager,
} from '@conduitplatform/grpc-sdk';
import { Core } from '../Core';
import { ConduitLogger } from '../utils/logger';
import { Status } from '@grpc/grpc-js/build/src/constants';

export class HttpServer {
  private _routingManager: RoutingManager;
  private readonly logger: ConduitLogger;

  constructor() {
    this.logger = new ConduitLogger();
  }

  initialize(grpcSdk: ConduitGrpcSdk, server: ConduitGrpcServer) {
    this._routingManager = new RoutingManager(grpcSdk.router!, server);
    this.registerRoutes();
  }

  private registerRoutes() {
    this._routingManager.route(
      {
        path: '/',
        action: Actions.GET,
      },
      new ConduitRouteReturnDefinition('HelloResult', 'String'),
      async () => {
        return 'Hello there!';
      },
    );

    this._routingManager.route(
      {
        path: '/health',
        action: Actions.GET,
        queryParams: {
          shouldCheck: 'String',
        },
      },
      new ConduitRouteReturnDefinition('HealthResult', 'String'),
      async () => {
        if (Core.getInstance().initialized) {
          return 'Conduit is online!';
        } else {
          throw new GrpcError(Status.FAILED_PRECONDITION, 'Conduit is not active yet!');
        }
      },
    );
    this._routingManager.registerRoutes().catch(() => {});
  }
}
