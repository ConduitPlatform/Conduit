import ConduitGrpcSdk, {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteActions as Actions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
  GrpcError,
  GrpcServer as ConduitGrpcServer,
  ParsedRouterRequest,
  RoutingManager,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { Core } from '../Core';
import { Status } from '@grpc/grpc-js/build/src/constants';
import { ConduitCommons } from '@conduitplatform/commons';
import CoreConfig from '../config';

export class HttpServer {
  private _routingManager: RoutingManager;
  private grpcSdk: ConduitGrpcSdk;
  private conduit: ConduitCommons;
  constructor() {}

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

    // this._routingManager.route(
    //   {
    //     path: '/config/core',
    //     action: ConduitRouteActions.PATCH,
    //     bodyParams: {
    //       config: {
    //         type: CoreConfig,
    //         required: true,
    //       },
    //     },
    //   },
    //   new ConduitRouteReturnDefinition('UpdateCoreConfig', {
    //     config: CoreConfig,
    //   }),
    //   async (call: ParsedRouterRequest) => {
    //     const newConfig = call.request.params!.config;
    //     const updatedConfig = await this.conduit
    //       .getCore()
    //       .setConfig(newConfig)
    //       .catch(e => {
    //         throw new ConduitError(e.name, e.status, e.message);
    //       });
    //     return { result: { config: updatedConfig } };
    //   },
    // );
    //
    // this._routingManager.route(
    //   {
    //     path: '/config/core',
    //     action: ConduitRouteActions.GET,
    //   },
    //   new ConduitRouteReturnDefinition('GetCoreConfig', {
    //     config: CoreConfig,
    //   }),
    //   async () => {
    //     let finalConfig = (await this.grpcSdk.state!.getKey('moduleConfigs.core')) as any;
    //     !finalConfig ? (finalConfig = {}) : (finalConfig = JSON.parse(finalConfig));
    //     return { result: { config: finalConfig } };
    //   },
    // );
    this._routingManager.registerRoutes().catch(() => {});
  }
}
