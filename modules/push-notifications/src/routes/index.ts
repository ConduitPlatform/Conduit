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
  private _routingManager: RoutingManager;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this.handlers = new NotificationTokensHandler();
    this._routingManager = new RoutingManager(this.grpcSdk.router!, server);
    this.registeredRoutes();
  }

  async registeredRoutes() {
    this._routingManager.clear();
    this._routingManager.route(
      {
        bodyParams: {
          token: TYPE.String,
          platform: TYPE.String,
        },
        action: ConduitRouteActions.POST,
        description: `Sets the given notification token for a user.`,
        middlewares: ['authMiddleware'],
        path: '/token',
      },
      new ConduitRouteReturnDefinition('SetNotificationTokenResponse', {
        newTokenDocument: NotificationToken.getInstance().fields,
      }),
      this.handlers.setNotificationToken.bind(this.handlers),
    );
    await this._routingManager.registerRoutes();
  }
}
