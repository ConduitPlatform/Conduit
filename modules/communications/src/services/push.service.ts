import { isNil } from 'lodash-es';
import { NotificationToken } from '../models/index.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { channelFailure } from '../utils/channelFailure.js';
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
      if (!this.isAvailable()) throw new ModuleError(errors.PUSH_NOT_CONFIGURED);
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
        ...channelFailure(error, errors.PUSH_PROVIDER_ERROR),
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
      })
      .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));

    const newTokenDocument = await NotificationToken.getInstance()
      .create({
        userId,
        token,
        platform,
      })
      .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));

    return newTokenDocument;
  }

  async getNotificationTokens(userId: string) {
    const tokenDocuments = await NotificationToken.getInstance()
      .findMany({ userId })
      .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));
    return tokenDocuments || [];
  }

  async sendNotification(params: ISendNotification): Promise<void> {
    if (!this.isAvailable()) {
      throw new ModuleError(errors.PUSH_NOT_CONFIGURED);
    }
    await this.provider!.sendToDevice(params).catch(
      ModuleError.rethrow(errors.PUSH_PROVIDER_ERROR),
    );
  }

  async sendToManyDevices(
    params: ISendNotificationToManyDevices,
  ): Promise<IPushSendAggregateResult> {
    if (!this.isAvailable()) {
      throw new ModuleError(errors.PUSH_NOT_CONFIGURED);
    }
    return this.provider!.sendToManyDevices(params).catch(
      ModuleError.rethrow(errors.PUSH_PROVIDER_ERROR),
    );
  }

  async sendManyNotifications(
    notifications: ISendNotification[],
  ): Promise<IPushSendAggregateResult> {
    if (!this.isAvailable()) {
      throw new ModuleError(errors.PUSH_NOT_CONFIGURED);
    }
    if (notifications.length === 0) {
      throw new ModuleError(errors.PUSH_NOTIFICATIONS_REQUIRED);
    }
    return this.provider!.sendMany(notifications).catch(
      ModuleError.rethrow(errors.PUSH_PROVIDER_ERROR),
    );
  }
}
