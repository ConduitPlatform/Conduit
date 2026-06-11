import { isNil } from 'lodash-es';
import { NotificationToken } from '../models/index.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  ChannelResult,
  ChannelStatus,
  IChannel,
  IChannelSendParams,
} from '../interfaces/index.js';
import { BaseNotificationProvider } from '../providers/push/base.provider.js';
import {
  IPushSendAggregateResult,
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
    if (!pushConfig.active) {
      this.provider = undefined;
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

  public getProvider(): BaseNotificationProvider<unknown> | undefined {
    return this.provider;
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

  async sendNotification(params: ISendNotification): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Provider not initialized');
    }
    await this.provider!.sendToDevice(params);
  }

  async sendToManyDevices(
    params: ISendNotificationToManyDevices,
  ): Promise<IPushSendAggregateResult> {
    if (!this.isAvailable()) {
      throw new Error('Provider not initialized');
    }
    return this.provider!.sendToManyDevices(params);
  }

  async sendManyNotifications(
    notifications: ISendNotification[],
  ): Promise<IPushSendAggregateResult> {
    if (!this.isAvailable()) {
      throw new Error('Provider not initialized');
    }
    if (notifications.length === 0) {
      throw new Error('notifications is required and must be a non-empty array');
    }
    return this.provider!.sendMany(notifications);
  }
}
