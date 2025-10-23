import { isNil } from 'lodash-es';
import { Notification, NotificationToken } from '../models/index.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  ChannelResult,
  ChannelStatus,
  IChannel,
  IChannelSendParams,
} from '../interfaces/index.js';
import { BaseNotificationProvider } from '../providers/push/base.provider.js';
import { validateNotification } from '../providers/push/utils/index.js';
import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../providers/push/interfaces/index.js';
import { Config } from '../config/index.js';
import { FirebaseProvider } from '../providers/push/Firebase.provider.js';
import { OneSignalProvider } from '../providers/push/OneSignal.provider.js';
import { AmazonSNSProvider } from '../providers/push/AmazonSNS.provider.js';

export class PushService implements IChannel {
  private provider?: BaseNotificationProvider<unknown>;
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  public async initPushProvider(config: Config) {
    const pushConfig = config.pushNotifications;

    if (!pushConfig || !pushConfig.providerName) {
      ConduitGrpcSdk.Logger.warn('Push notifications not configured');
      return;
    }

    const name = pushConfig.providerName;
    const settings = (pushConfig as any)[name];

    try {
      if (name === 'firebase') {
        this.provider = new FirebaseProvider(settings);
      } else if (name === 'onesignal') {
        this.provider = new OneSignalProvider(settings);
      } else if (name === 'basic') {
        this.provider = new BaseNotificationProvider();
      } else if (name === 'sns') {
        this.provider = new AmazonSNSProvider(settings);
      } else {
        ConduitGrpcSdk.Logger.error(`Unknown push provider: ${name}`);
      }
    } catch (e) {
      this.provider = undefined;
      ConduitGrpcSdk.Logger.error('Failed to initialize push provider:', e);
    }
  }

  isAvailable(): boolean {
    return !!this.provider && this.provider.isInitialized;
  }

  async send(params: IChannelSendParams): Promise<ChannelResult> {
    try {
      if (!this.isAvailable()) throw Error('Push not initialized');
      const { recipient, subject, body, data, platform, doNotStore, isSilent } = params;

      const notificationParams: ISendNotification = {
        sendTo: recipient,
        title: subject,
        body,
        data,
        platform,
        doNotStore,
        isSilent,
      };

      await this.provider!.sendToDevice(notificationParams);

      return {
        success: true,
        channel: 'push',
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        channel: 'push',
      };
    }
  }

  async sendMany(params: IChannelSendParams[]): Promise<ChannelResult[]> {
    const results: ChannelResult[] = [];

    for (const param of params) {
      const result = await this.send(param);
      results.push(result);
    }

    return results;
  }

  async getStatus(messageId: string): Promise<ChannelStatus> {
    // Push notifications don't typically have status tracking like email
    return {
      status: 'sent' as const,
      messageId,
      timestamp: new Date(),
    };
  }

  async setNotificationToken(token: string, platform: string, userId: string) {
    await NotificationToken.getInstance()
      .findOne({ userId, platform })
      .then(oldToken => {
        if (!isNil(oldToken)) return NotificationToken.getInstance().deleteOne(oldToken);
      });

    const newTokenDocument = await NotificationToken.getInstance().create({
      userId,
      token,
      platform,
    });

    return newTokenDocument;
  }

  async getNotificationTokens(userId: string) {
    const tokenDocuments = await NotificationToken.getInstance().findMany({ userId });
    return tokenDocuments || [];
  }

  async sendNotification(params: ISendNotification) {
    if (!this.isAvailable()) {
      throw new Error('Provider not initialized');
    }

    validateNotification(params);
    if (!params.doNotStore && !params.isSilent) {
      await Notification.getInstance().create({
        user: params.sendTo,
        title: params.title,
        body: params.body,
        data: params.data,
        platform: params.platform,
      });
    }

    if (this.provider!.isBaseProvider) return;

    const notificationTokens = await this.provider!.fetchTokens(
      params.sendTo,
      params.platform,
    );
    if (notificationTokens.length === 0) {
      throw new Error('No notification token found');
    }

    const promises = notificationTokens.map(async notToken => {
      await this.provider!.sendMessage(notToken.token, {
        ...params,
        platform: params.platform ?? notToken.platform,
      });
    });

    return Promise.all(promises);
  }

  async sendToManyDevices(params: ISendNotificationToManyDevices) {
    if (!this.isAvailable()) {
      throw new Error('Provider not initialized');
    }

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

    if (this.provider!.isBaseProvider) return;

    const notificationTokens = await this.provider!.fetchTokens(
      params.sendTo,
      params.platform,
    );
    if (notificationTokens.length === 0) {
      throw new Error('Could not find tokens');
    }

    const promises = notificationTokens.map(async notToken => {
      await this.provider!.sendMessage(notToken.token, {
        ...params,
        platform: params.platform ?? notToken.platform,
      });
    });

    return Promise.all(promises);
  }

  async sendManyNotifications(notifications: ISendNotification[]) {
    if (!this.isAvailable()) {
      throw new Error('Provider not initialized');
    }

    const notificationsToStore: {
      user: string;
      title?: string;
      body?: string;
      data?: any;
      platform?: string;
    }[] = [];

    notifications.forEach(param => {
      validateNotification(param);
      if (param.doNotStore || param.isSilent) return;
      notificationsToStore.push({
        user: param.sendTo,
        title: param.title,
        body: param.body,
        data: param.data,
        platform: param.platform,
      });
    });

    if (notificationsToStore.length !== 0) {
      await Notification.getInstance().createMany(notificationsToStore);
    }

    if (this.provider!.isBaseProvider) return;

    const userIds = notifications.map(param => param.sendTo);
    const notificationsObj = notifications.reduce(
      (acc, param) => {
        acc[param.sendTo] = param;
        return acc;
      },
      {} as Record<string, ISendNotification>,
    );

    const notificationTokens = await this.provider!.fetchTokens(userIds);
    if (!notificationTokens || notificationTokens.length === 0) {
      throw new Error('Could not find tokens');
    }

    const promises = notificationTokens.map(async token => {
      const id = token.userId.toString();
      const data = notificationsObj[id];
      if (data.platform && data.platform !== token.platform) return;
      await this.provider!.sendMessage(token.token, {
        ...data,
        platform: data.platform ?? token.platform,
      }).catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    });

    return Promise.all(promises);
  }
}
