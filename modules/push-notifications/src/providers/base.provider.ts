import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../interfaces/ISendNotification';
import { Notification, NotificationToken, User } from '../models';
import { PlatformTypesEnum } from '@conduitplatform/grpc-sdk';

export class BaseNotificationProvider {
  get isInitialized(): boolean {
    return true;
  }

  sendToDevice(params: ISendNotification): Promise<any> {
    if (params.doNotStore) return Promise.resolve();
    return Notification.getInstance().create({
      user: params.sendTo,
      title: params.title,
      body: params.body,
      data: params.data,
      platform: params.platform,
    });
  }

  fetchTokens(
    users: string | string[],
  ): Promise<NotificationToken | NotificationToken[] | null> {
    if (Array.isArray(users)) {
      return NotificationToken.getInstance().findMany({
        userId: { $in: users },
      });
    }
    return NotificationToken.getInstance().findOne({
      userId: users as string,
    });
  }

  async sendMany(params: ISendNotification[]): Promise<any> {
    let notifications: {
      user: string | User;
      title: string;
      body?: string;
      data?: any;
      platform?: string | PlatformTypesEnum;
    }[] = [];
    params.forEach(param => {
      if (param.doNotStore) return;
      notifications.push({
        user: param.sendTo,
        title: param.title,
        body: param.body,
        data: param.data,
        platform: param.platform,
      });
    });
    return await Notification.getInstance().createMany(notifications);
  }

  sendToManyDevices(params: ISendNotificationToManyDevices): Promise<any> {
    if (params.doNotStore) return Promise.resolve();
    return Notification.getInstance().createMany(
      params.sendTo.map(userId => ({
        user: userId,
        title: params.title,
        body: params.body,
        data: params.data,
        platform: params.platform,
      })),
    );
  }
}
