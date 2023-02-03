import {
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { Notification, NotificationToken } from '../models';

export class NotificationTokensHandler {
  async setNotificationToken(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    const { token, platform } = call.request.params;
    await NotificationToken.getInstance().deleteMany({
      userId: context.user._id,
      platform,
    });
    const newTokenDocument = await NotificationToken.getInstance().create({
      userId: context.user._id,
      token,
      platform,
    });

    return {
      newTokenDocument,
    };
  }

  async clearNotificationTokens(
    call: ParsedRouterRequest,
  ): Promise<UnparsedRouterResponse> {
    const context = call.request.context;

    let query: { userId: string; platform?: string } = { userId: context.user._id };
    if (call.request.params.platform) {
      query = { ...query, platform: call.request.params.platform };
    }
    await NotificationToken.getInstance().deleteMany(query);

    return 'OK';
  }

  async getUserNotifications(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { read, skip, limit, platform } = call.request.params;

    let query: { user: string; platform?: string; read?: boolean } = { user: user._id };
    if (platform) {
      query = { ...query, platform };
    }
    if (read) {
      query = { ...query, read };
    }
    const notifications = await Notification.getInstance().findMany(
      query,
      undefined,
      skip ?? 0,
      limit,
      {
        createdAt: -1,
      },
    );

    const countAll = { ...query };
    delete countAll.read;
    const notificationCount = await Notification.getInstance().countDocuments(countAll);
    const unreadCount = await Notification.getInstance().countDocuments({
      ...query,
      read: false,
    });
    return {
      notifications,
      count: notificationCount,
      unreadCount,
    };
  }

  async readUserNotification(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { before, id } = call.request.params;

    if (!before && !id) {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'Either before or id must be provided',
      );
    }

    if (before) {
      await Notification.getInstance().updateMany(
        { user: user._id, createdAt: { $lt: before } },
        { read: true, readAt: Date.now() },
      );
    } else {
      let notification = await Notification.getInstance().findOne({
        _id: id,
        user: user._id,
      });
      if (!notification) {
        throw new GrpcError(status.NOT_FOUND, 'Notification not found');
      }
      await Notification.getInstance().findByIdAndUpdate(id, {
        read: true,
        readAt: Date.now(),
      });
    }
    return 'OK';
  }
}
