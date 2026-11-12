import {
  ParsedRouterRequest,
  PlatformTypesEnum,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../errors.js';
import { isNil } from 'lodash-es';
import { Notification, NotificationToken } from '../../models/index.js';
import { PushService } from '../../services/push.service.js';

export class NotificationTokensHandler {
  constructor(private readonly pushService: PushService) {}

  async setNotificationToken(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    const { token, platform } = call.request.params;

    const provider = this.pushService.getProvider();
    // Tokens are stored even while the provider is not initialised yet (bad or pending
    // credentials), so they are usable as soon as it is.
    if (!provider) {
      throw new ModuleError(errors.PUSH_NOT_CONFIGURED);
    }

    await NotificationToken.getInstance()
      .deleteMany({
        userId: context.user._id,
        platform,
      })
      .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));

    const registeredToken = await provider
      .registerDeviceToken(token, platform as PlatformTypesEnum)
      .catch(ModuleError.rethrow(errors.PUSH_PROVIDER_ERROR));

    const newTokenDocument = await NotificationToken.getInstance()
      .create({
        userId: context.user._id,
        token: registeredToken,
        platform,
      })
      .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));

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
    await NotificationToken.getInstance()
      .deleteMany(query)
      .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));

    return 'OK';
  }

  async getUserNotifications(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { read, skip, limit, platform } = call.request.params;

    let query: { user: string; platform?: string; read?: boolean } = { user: user._id };
    if (platform) {
      query = { ...query, platform };
    }
    if (!isNil(read)) {
      query = { ...query, read };
    }
    const notifications = await Notification.getInstance()
      .findMany(query, {
        skip: skip ?? 0,
        limit,
        sort: { createdAt: -1 },
      })
      .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));

    const notificationCount = await Notification.getInstance()
      .countDocuments(query)
      .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));
    const unreadCount = await Notification.getInstance()
      .countDocuments({
        ...query,
        read: false,
      })
      .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));
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
      throw new ModuleError(errors.NOTIFICATION_READ_PARAMS_REQUIRED);
    }

    if (before) {
      await Notification.getInstance()
        .updateMany(
          { user: user._id, createdAt: { $lt: before } },
          { read: true, readAt: Date.now() },
        )
        .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));
    } else {
      const notification = await Notification.getInstance()
        .findOne({
          _id: id,
          user: user._id,
        })
        .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));
      if (!notification) {
        throw new ModuleError(errors.NOTIFICATION_NOT_FOUND);
      }
      await Notification.getInstance()
        .findByIdAndUpdate(id, {
          read: true,
          readAt: Date.now(),
        })
        .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));
    }
    return 'OK';
  }
}
