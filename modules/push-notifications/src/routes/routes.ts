import { NotificationTokensHandler } from '../handlers/notification-tokens';
import ConduitGrpcSdk, {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  constructRoute,
  GrpcServer,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { NotificationToken } from '../models';

export class PushNotificationsRoutes {
  private readonly handlers: NotificationTokensHandler;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this.handlers = new NotificationTokensHandler();
    this.grpcSdk.router
      .registerRouterAsync(server, this.registeredRoutes, {
        setNotificationToken: this.handlers.setNotificationToken.bind(this.handlers),
      })
      .catch((err: Error) => {
        console.log('Failed to register routes for module');
        console.log(err);
      });
  }

  get registeredRoutes(): any[] {
    let routesArray: any = [];

    routesArray.push(
      constructRoute(
        new ConduitRoute(
          {
            bodyParams: {
              token: TYPE.String,
              platform: TYPE.String,
            },
            action: ConduitRouteActions.POST,
            path: '/token',
          },
          new ConduitRouteReturnDefinition('SetNotificationTokenResponse', {
            message: TYPE.String,
            newTokenDocument: NotificationToken.getInstance().fields,
          }),
          'setNotificationToken'
        )
      )
    );

    return routesArray;
  }
}
