import { NotificationTokensHandler } from '../handlers/notification-tokens.js';
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
  RoutingManager,
} from '@conduitplatform/module-tools';

import { Notification, NotificationToken } from '../models/index.js';

export class PushNotificationsRoutes {
  private readonly handlers: NotificationTokensHandler;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.handlers = new NotificationTokensHandler();
  }

  async registerRoutes(_routingManager: RoutingManager) {
    _routingManager.route(
      {
        bodyParams: {
          token: ConduitString.Required,
          platform: ConduitString.Required,
        },
        action: ConduitRouteActions.POST,
        description: `Sets the given notification token for a user.`,
        middlewares: ['authMiddleware'],
        path: '/token',
      },
      new ConduitRouteReturnDefinition('SetNotificationTokenResponse', {
        newTokenDocument: NotificationToken.getInstance().fields, // @type-inconsistency
      }),
      this.handlers.setNotificationToken.bind(this.handlers),
    );
    _routingManager.route(
      {
        queryParams: {
          platform: ConduitString.Optional,
        },
        action: ConduitRouteActions.DELETE,
        description: `Removes tokens for a user (optionally for specific platform). This effectively disables push notifications for the user, but not the notification center.`,
        middlewares: ['authMiddleware'],
        path: '/token',
      },
      new ConduitRouteReturnDefinition('SetNotificationTokenResponse', 'String'),
      this.handlers.clearNotificationTokens.bind(this.handlers),
    );
    _routingManager.route(
      {
        queryParams: {
          read: ConduitBoolean.Optional,
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          platform: ConduitString.Optional,
        },
        action: ConduitRouteActions.GET,
        description: `Get User notifications`,
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
    _routingManager.route(
      {
        bodyParams: {
          before: ConduitDate.Optional,
          id: ConduitString.Optional,
        },
        action: ConduitRouteActions.PATCH,
        description: `Read user notifications. If before is provided, any notification before that date will be marked as read. If id is provided, only that notification will be marked as read.`,
        middlewares: ['authMiddleware'],
        path: '/notifications',
      },
      new ConduitRouteReturnDefinition('ReadNotificationsResponse', 'String'),
      this.handlers.readUserNotification.bind(this.handlers),
    );
  }
}
