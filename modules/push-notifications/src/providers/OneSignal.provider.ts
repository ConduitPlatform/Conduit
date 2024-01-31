import { BaseNotificationProvider } from './base.provider.js';
import { IOneSignalSettings } from '../interfaces/IOneSignalSettings.js';
import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../interfaces/ISendNotification.js';
import * as OneSignal from '@onesignal/node-onesignal';
import { Notification } from '@onesignal/node-onesignal';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';

export class OneSignalProvider extends BaseNotificationProvider<IOneSignalSettings> {
  private client?: OneSignal.DefaultApi;
  private readonly appId: string;

  constructor(settings: IOneSignalSettings) {
    super();
    this._initialized = false;
    this.isBaseProvider = false;
    this.updateProvider(settings);
    this.appId = settings.appId;
  }

  async sendMessage(
    token: string | string[],
    params: ISendNotification | ISendNotificationToManyDevices,
  ) {
    const { title, body, data } = params;

    let notification: Notification;
    if (params.isSilent) {
      notification = {
        content_available: true,
        app_id: this.appId,
        data: { ...data },
        include_player_ids: Array.isArray(token) ? token : [token],
      };
    } else {
      notification = {
        app_id: this.appId,
        contents: { en: body ?? '' },
        headings: { en: title },
        data: { ...data },
        include_player_ids: Array.isArray(token) ? token : [token],
      };
    }
    await this.client!.createNotification(notification);
    return;
  }

  updateProvider(settings: IOneSignalSettings) {
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
}
