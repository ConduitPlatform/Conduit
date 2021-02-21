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

export class PushNotificationsRoutes {
  private readonly handlers: NotificationTokensHandler;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this.handlers = new NotificationTokensHandler(grpcSdk);
    this.grpcSdk.router
      .registerRouter(server, this.registeredRoutes, {
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
