import { NotificationTokensHandler } from '../handlers/push/notification-tokens.js';
import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitBoolean,
  ConduitDate,
  ConduitNumber,
  ConduitString,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { Notification, NotificationToken } from '../models/index.js';
import { PushService } from '../services/push.service.js';

export class PushNotificationsRoutes {
  private readonly handlers: NotificationTokensHandler;
  private _routingManager: RoutingManager;

  constructor(
    readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    pushService: PushService,
  ) {
    this.handlers = new NotificationTokensHandler(pushService);
    this._routingManager = new RoutingManager(this.grpcSdk.router!, server);
    this.registerRoutes();
  }

  async registerRoutes() {
    this._routingManager.clear();

    // Set notification token route
    this._routingManager.route(
      {
        bodyParams: {
          token: ConduitString.Required,
          platform: ConduitString.Required,
        },
        action: ConduitRouteActions.POST,
        description: 'Sets the given notification token for a user.',
        middlewares: ['authMiddleware'],
        path: '/token',
      },
      new ConduitRouteReturnDefinition('SetNotificationTokenResponse', {
        newTokenDocument: NotificationToken.getInstance().fields,
      }),
      this.handlers.setNotificationToken.bind(this.handlers),
    );

    // Clear notification token route
    this._routingManager.route(
      {
        queryParams: {
          platform: ConduitString.Optional,
        },
        action: ConduitRouteActions.DELETE,
        description: 'Removes tokens for a user (optionally for specific platform).',
        middlewares: ['authMiddleware'],
        path: '/token',
      },
      new ConduitRouteReturnDefinition('ClearNotificationTokenResponse', 'String'),
      this.handlers.clearNotificationTokens.bind(this.handlers),
    );

    // Get user notifications route
    this._routingManager.route(
      {
        queryParams: {
          read: ConduitBoolean.Optional,
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          platform: ConduitString.Optional,
        },
        action: ConduitRouteActions.GET,
        description: 'Get User notifications',
        middlewares: ['authMiddleware'],
        path: '/notifications',
      },
      new ConduitRouteReturnDefinition('GetNotificationsResponse', {
        notifications: [Notification.name],
        count: TYPE.Number,
        unreadCount: TYPE.Number,
      }),
      this.handlers.getUserNotifications.bind(this.handlers),
    );

    // Mark notifications as read route
    this._routingManager.route(
      {
        bodyParams: {
          before: ConduitDate.Optional,
          id: ConduitString.Optional,
        },
        action: ConduitRouteActions.PATCH,
        description: 'Read user notifications.',
        middlewares: ['authMiddleware'],
        path: '/notifications',
      },
      new ConduitRouteReturnDefinition('ReadNotificationsResponse', 'String'),
      this.handlers.readUserNotification.bind(this.handlers),
    );

    await this._routingManager.registerRoutes();
  }
}
