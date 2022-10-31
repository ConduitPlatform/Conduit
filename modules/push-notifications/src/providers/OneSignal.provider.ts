import { IPushNotificationsProvider } from '../interfaces/IPushNotificationsProvider';
import { IOneSignalSettings } from '../interfaces/IOneSignalSettings';
import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../interfaces/ISendNotification';
import * as OneSignal from '@onesignal/node-onesignal';
import { isNil, keyBy, isEmpty } from 'lodash';
import { NotificationToken } from '../models';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export class OneSignalProvider implements IPushNotificationsProvider {
  private client?: OneSignal.DefaultApi;
  private readonly appId: string;
  private _initialized: boolean = false;

  constructor(settings: IOneSignalSettings) {
    this.updateProvider(settings);
    this.appId = settings.appId;
  }

  get isInitialized(): boolean {
    return this._initialized;
  }

  private updateProvider(settings: IOneSignalSettings) {
    const app_key_provider: { getToken(): string } = {
      getToken(): string {
        return settings.apiKey;
      },
    };
    const configuration = OneSignal.createConfiguration({
      authMethods: {
        app_key: {
          tokenProvider: app_key_provider,
        },
      },
    });
    try {
      this.client = new OneSignal.DefaultApi(configuration);
      this._initialized = true;
    } catch (e) {
      this._initialized = false;
      ConduitGrpcSdk.Logger.error('Failed to initialize OneSignal');
    }
  }
  async sendToDevice(params: ISendNotification) {
    const userId = params.sendTo;
    const platform = params.platform;
    if (isNil(userId)) return;
    const notificationToken = await NotificationToken.getInstance().findOne({
      userId,
      platform,
    });

    if (isNil(notificationToken)) {
      throw new Error('Notification token not found');
    }
    const { title, body, data } = params;
    const notification = {
      app_id: this.appId,
      contents: { en: body ?? '' },
      headings: { en: title },
      data: { ...data, userId },
      include_player_ids: [notificationToken.token],
    };
    return this.client!.createNotification(notification).catch(e => {
      ConduitGrpcSdk.Logger.error(e);
    });
  }

  async sendToManyDevices(params: ISendNotificationToManyDevices) {
    const notificationTokens = await NotificationToken.getInstance().findMany({
      userId: { $in: params.sendTo },
    });
    if (isEmpty(notificationTokens)) return;
    const playerIds = notificationTokens.map(token => token.token);
    const notification = {
      app_id: this.appId,
      contents: { en: params.body ?? '' },
      headings: { en: params.title },
      data: { ...params.data },
      include_player_ids: playerIds,
    };

    return this.client!.createNotification(notification);
  }

  async sendMany(params: ISendNotification[]) {
    const userIds = params.map(param => param.sendTo);
    const notificationsObj = keyBy(params, param => param.sendTo);

    const notificationTokens = await NotificationToken.getInstance().findMany({
      userId: { $in: userIds },
    });
    if (isEmpty(notificationTokens)) return;

    const promises = notificationTokens.map(async token => {
      const id = token.userId.toString();
      const data = notificationsObj[id];
      const notification = {
        app_id: this.appId,
        contents: { en: data.body ?? '' },
        headings: { en: data.title },
        data,
        include_player_ids: [token.token],
      };
      await this.client!.createNotification(notification).catch(e => {
        ConduitGrpcSdk.Logger.error(e);
      });
    });
    return Promise.all(promises);
  }
}
