import { NotificationTokensHandler } from '../handlers/notification-tokens';
import ConduitGrpcSdk, {
  ConduitDate,
  ConduitObjectId,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  constructRoute,
  GrpcServer,
  TYPE,
} from '@quintessential-sft/conduit-grpc-sdk';
import path from 'path';

export class PushNotificationsRoutes {
  private readonly handlers: NotificationTokensHandler;

  constructor(server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this.handlers = new NotificationTokensHandler(grpcSdk);
    server
      .addService(
        path.resolve(__dirname, './router.proto'),
        'pushnotifications.router.Router',
        {
          setNotificationToken: this.handlers.setNotificationToken.bind(this.handlers),
        }
      )
      .catch(() => {
        console.log('Failed to register routes');
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
            path: '/notification-token',
          },
          new ConduitRouteReturnDefinition('SetNotificationTokenResponse', {
            message: TYPE.String,
            newTokenDocument: {
              _id: ConduitObjectId.Required,
              userId: ConduitObjectId.Required,
              token: ConduitString.Required,
              createdAt: ConduitDate.Required,
              updatedAt: ConduitDate.Required,
            },
          }),
          'setNotificationToken'
        )
      )
    );

    return routesArray;
  }
}
