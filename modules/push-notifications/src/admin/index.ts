import ConduitGrpcSdk, {
  GrpcServer,
  constructConduitRoute,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  RouteOptionType,
  ConduitString,
  TYPE,
  ConduitRouteObject,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { isNil } from 'lodash';
import { IPushNotificationsProvider } from '../interfaces/IPushNotificationsProvider';
import { NotificationToken } from '../models';

export class AdminHandlers {
  private provider: IPushNotificationsProvider;

  constructor(
    private readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    provider: IPushNotificationsProvider,
  ) {
    this.provider = provider;
    this.registerAdminRoutes();
  }

  updateProvider(provider: IPushNotificationsProvider) {
    this.provider = provider;
  }

  private registerAdminRoutes() {
    const paths = this.getRegisteredRoutes();
    this.grpcSdk.admin
      .registerAdminAsync(this.server, paths, {
        sendNotification: this.sendNotification.bind(this),
        sendNotificationToManyDevices: this.sendNotificationToManyDevices.bind(this),
        getNotificationToken: this.getNotificationToken.bind(this),
      })
      .catch((err: Error) => {
        ConduitGrpcSdk.Logger.error('Failed to register admin routes for module!');
        ConduitGrpcSdk.Logger.error(err);
      });
  }

  private getRegisteredRoutes(): ConduitRouteObject[] {
    return [
      constructConduitRoute(
        {
          path: '/send',
          action: ConduitRouteActions.POST,
          description: `Sends a notification.`,
          bodyParams: {
            userId: ConduitString.Required,
            title: ConduitString.Required,
            body: ConduitString.Optional,
            data: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('SendNotification', 'String'),
        'sendNotification',
      ),
      constructConduitRoute(
        {
          path: '/sendToManyDevices',
          action: ConduitRouteActions.POST,
          description: `Sends a notification to multiple devices.`,
          bodyParams: {
            userIds: { type: [TYPE.String], required: true }, // handler array check is still required
            title: ConduitString.Required,
            body: ConduitString.Optional,
            data: ConduitString.Optional,
          },
        },
        new ConduitRouteReturnDefinition('SendNotificationToManyDevices', 'String'),
        'sendNotificationToManyDevices',
      ),
      constructConduitRoute(
        {
          path: '/token/:userId',
          action: ConduitRouteActions.GET,
          description: `Returns a user's notification token.`,
          urlParams: {
            userId: { type: RouteOptionType.String, required: true },
          },
        },
        new ConduitRouteReturnDefinition('GetNotificationToken', {
          tokenDocuments: ['NotificationToken'],
        }),
        'getNotificationToken',
      ),
    ];
  }

  async sendNotification(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = {
      sendTo: call.request.params.userId,
      title: call.request.params.title,
      body: call.request.params.body,
      data: call.request.params.data,
    };
    await this.provider.sendToDevice(params).catch(e => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
    ConduitGrpcSdk.Metrics?.increment('push_notifications_sent_total', 1, {
      devices_count: 1,
    });
    return 'Ok';
  }

  async sendNotificationToManyDevices(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    if (call.request.params.userIds.length === 0) {
      // array check is required
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'ids is required and must be an non-empty array',
      );
    }
    const params = {
      sendTo: call.request.params.userIds,
      title: call.request.params.title,
      body: call.request.params.body,
      data: call.request.params.data,
    };
    await this.provider.sendToManyDevices(params).catch(e => {
      throw new GrpcError(status.INTERNAL, e.message);
    });
    ConduitGrpcSdk.Metrics?.increment('push_notifications_sent_total', 1, {
      devices_count: call.request.params.userIds.length,
    });
    return 'Ok';
  }

  async getNotificationToken(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const tokenDocuments = await NotificationToken.getInstance().findMany({
      userId: call.request.params.userId,
    });
    if (isNil(tokenDocuments)) {
      throw new GrpcError(status.NOT_FOUND, 'Could not find a token for user');
    }
    return { tokenDocuments };
  }
}
