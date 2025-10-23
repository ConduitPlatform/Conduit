import { ConduitGrpcSdk, PlatformTypesEnum } from '@conduitplatform/grpc-sdk';
import { validateNotification } from './utils/index.js';
import { isNil, keyBy } from 'lodash-es';
import { NotificationToken, Notification, User } from '../../models/index.js';
import { ISendNotification, ISendNotificationToManyDevices } from './interfaces/index.js';

export class BaseNotificationProvider<T> {
  _initialized: boolean = true;
  isBaseProvider: boolean = true;

  get isInitialized(): boolean {
    return this._initialized;
  }

  async registerDeviceToken(token: string, platform: PlatformTypesEnum): Promise<string> {
    return token;
  }

  sendMessage(
    token: string | string[],
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<void | string> {
    return Promise.resolve();
  }

  async sendToDevice(params: ISendNotification): Promise<any> {
    if (!this._initialized) throw new Error('Provider not initialized');
    const { sendTo } = params;
    if (isNil(sendTo)) return;
    validateNotification(params);
    if (!params.doNotStore || !params.isSilent) {
      await Notification.getInstance().create({
        user: params.sendTo,
        title: params.title,
        body: params.body,
        data: params.data,
        platform: params.platform,
      });
    }
    if (this.isBaseProvider) return;
    const notificationTokens = await this.fetchTokens(sendTo, params.platform);
    if (notificationTokens.length === 0) {
      throw new Error('No notification token found');
    }
    const promises = notificationTokens.map(async notToken => {
      await this.sendMessage(notToken.token, {
        ...params,
        platform: params.platform ?? notToken.platform,
      });
    });
    return Promise.all(promises);
  }

  fetchTokens(users: string | string[], platform?: string): Promise<NotificationToken[]> {
    if (Array.isArray(users)) {
      return NotificationToken.getInstance().findMany({
        userId: { $in: users },
        ...(platform ? { platform } : {}),
      });
    }
    return NotificationToken.getInstance().findMany({
      userId: users as string,
      ...(platform ? { platform } : {}),
    });
  }

  async sendMany(params: ISendNotification[]): Promise<any> {
    if (!this._initialized) throw new Error('Provider not initialized');
    const notifications: {
      user: string | User;
      title?: string;
      body?: string;
      data?: any;
      platform?: string | PlatformTypesEnum;
    }[] = [];
    params.forEach(param => {
      validateNotification(param);
      if (param.doNotStore || param.isSilent) return;
      notifications.push({
        user: param.sendTo,
        title: param.title,
        body: param.body,
        data: param.data,
        platform: param.platform,
      });
    });
    if (notifications.length !== 0) {
      await Notification.getInstance().createMany(notifications);
    }
    if (this.isBaseProvider) return;
    const userIds = params.map(param => param.sendTo);
    const notificationsObj = keyBy(params, param => param.sendTo);

    const notificationTokens = (await this.fetchTokens(userIds)) as NotificationToken[];
    if (!notificationTokens || notificationTokens.length === 0)
      throw new Error('Could not find tokens');
    const promises = notificationTokens.map(async token => {
      const id = token.userId.toString();
      const data = notificationsObj[id];
      if (data.platform && data.platform !== token.platform) return;
      await this.sendMessage(token.token, {
        ...data,
        platform: data.platform ?? token.platform,
      }).catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    });
    return Promise.all(promises);
  }

  async sendToManyDevices(params: ISendNotificationToManyDevices): Promise<any> {
    if (!this._initialized) throw new Error('Provider not initialized');

    validateNotification(params);
    if (!params.doNotStore && !params.isSilent) {
      await Notification.getInstance().createMany(
        params.sendTo.map(userId => ({
          user: userId,
          title: params.title,
          body: params.body,
          data: params.data,
          platform: params.platform,
        })),
      );
    }
    if (this.isBaseProvider) return;
    const notificationTokens = (await this.fetchTokens(
      params.sendTo,
      params.platform,
    )) as NotificationToken[];

    if (notificationTokens.length === 0) throw new Error('Could not find tokens');
    const promises = notificationTokens.map(async notToken => {
      await this.sendMessage(notToken.token, {
        ...params,
        platform: params.platform ?? notToken.platform,
      });
    });
    return Promise.all(promises);
  }
}
