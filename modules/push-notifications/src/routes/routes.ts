import { NotificationTokensHandler } from '../handlers/notification-tokens';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcServer,
  RoutingManager,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { NotificationToken } from '../models';

export class PushNotificationsRoutes {
  private readonly handlers: NotificationTokensHandler;
  private _routingController: RoutingManager;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this.handlers = new NotificationTokensHandler();
    this._routingController = new RoutingManager(this.grpcSdk.router, server);
    this.registeredRoutes();
  }

  async registeredRoutes() {
    this._routingController.clear();
    this._routingController.route(
      {
        bodyParams: {
          token: TYPE.String,
          platform: TYPE.String,
        },
        action: ConduitRouteActions.POST,
        middlewares: ['authMiddleware'],
        path: '/token',
      },
      new ConduitRouteReturnDefinition('SetNotificationTokenResponse', {
        message: TYPE.String,
        newTokenDocument: NotificationToken.getInstance().fields,
      }),
      this.handlers.setNotificationToken.bind(this.handlers),
    );
    await this._routingController.registerRoutes();
  }
}
