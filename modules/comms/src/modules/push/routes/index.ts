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
        path: '/push/token',
        action: ConduitRouteActions.POST,
        description: `Sets the given notification token for a user.`,
        bodyParams: {
          token: ConduitString.Required,
          platform: ConduitString.Required,
        },

        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('SetNotificationTokenResponse', {
        newTokenDocument: NotificationToken.getInstance().fields, // @type-inconsistency
      }),
      this.handlers.setNotificationToken.bind(this.handlers),
    );
    _routingManager.route(
      {
        path: '/token',
        action: ConduitRouteActions.DELETE,
        description: `Removes tokens for a user (optionally for specific platform). This effectively disables push notifications for the user, but not the notification center.`,
        queryParams: {
          platform: ConduitString.Optional,
        },

        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('SetNotificationTokenResponse', 'String'),
      this.handlers.clearNotificationTokens.bind(this.handlers),
    );
    _routingManager.route(
      {
        path: '/push/notifications',
        action: ConduitRouteActions.GET,
        queryParams: {
          read: ConduitBoolean.Optional,
          skip: ConduitNumber.Optional,
          limit: ConduitNumber.Optional,
          platform: ConduitString.Optional,
        },

        description: `Get User notifications`,
        middlewares: ['authMiddleware'],
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
        path: '/push/notifications',
        action: ConduitRouteActions.PATCH,
        description: `Read user notifications. If before is provided, any notification before that date will be marked as read. If id is provided, only that notification will be marked as read.`,
        bodyParams: {
          before: ConduitDate.Optional,
          id: ConduitString.Optional,
        },

        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('ReadNotificationsResponse', 'String'),
      this.handlers.readUserNotification.bind(this.handlers),
    );
  }
}
