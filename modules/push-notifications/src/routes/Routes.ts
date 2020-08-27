import { NotificationTokensHandler } from '../handlers/notification-tokens';
import * as grpc from 'grpc';
import ConduitGrpcSdk, {
  ConduitDate,
  ConduitObjectId,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition, ConduitString,
  constructRoute,
  TYPE
} from '@quintessential-sft/conduit-grpc-sdk';

var protoLoader = require('@grpc/proto-loader');
var PROTO_PATH = __dirname + '/router.proto';

export class PushNotificationsRoutes {
  private readonly handlers: NotificationTokensHandler;

  constructor(server: grpc.Server, private readonly grpcSdk: ConduitGrpcSdk) {
    this.handlers = new NotificationTokensHandler(grpcSdk);
    const packageDefinition = protoLoader.loadSync(
      PROTO_PATH,
      {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      }
    );
    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    // @ts-ignore
    const router = protoDescriptor.pushnotifications.router.Router;
    server.addService(router.service, {
      setNotificationToken: this.handlers.setNotificationToken.bind(this.handlers)
    });
  }

  get registeredRoutes(): any[] {
    let routesArray: any = [];

    routesArray.push(constructRoute(new ConduitRoute({
        bodyParams: {
          token: TYPE.String,
          platform: TYPE.String
        },
        action: ConduitRouteActions.POST,
        path: '/notification-token'
      },
      new ConduitRouteReturnDefinition('SetNotificationTokenResponse', {
        message: TYPE.String, newTokenDocument: {
          _id: ConduitObjectId.Required,
          userId: ConduitObjectId.Required,
          token: ConduitString.Required,
          createdAt: ConduitDate.Required,
          updatedAt: ConduitDate.Required
        }
      }),
      'setNotificationToken'
    )));

    return routesArray;
  }
}
