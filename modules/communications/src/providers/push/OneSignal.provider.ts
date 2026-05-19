import { BaseNotificationProvider } from './base.provider.js';
import { createConfiguration, DefaultApi, Notification } from '@onesignal/node-onesignal';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { IOneSignalSettings } from '../../interfaces/index.js';
import { ISendNotification, ISendNotificationToManyDevices } from './interfaces/index.js';
import { NotificationToken } from '../../models/index.js';

export class OneSignalProvider extends BaseNotificationProvider<IOneSignalSettings> {
  private client?: DefaultApi;
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
        include_subscription_ids: Array.isArray(token) ? token : [token],
      };
    } else {
      notification = {
        app_id: this.appId,
        contents: { en: body ?? '' },
        headings: { en: title },
        data: { ...data },
        include_subscription_ids: Array.isArray(token) ? token : [token],
      };
    }
    const response = await this.client!.createNotification(notification);
    if (response.errors?.invalid_player_ids?.length) {
      await NotificationToken.getInstance().deleteMany({
        token: { $in: response.errors.invalid_player_ids },
      });
    }
    return;
  }

  updateProvider(settings: IOneSignalSettings) {
    const configuration = createConfiguration({
      restApiKey: settings.apiKey,
    });
    try {
      this.client = new DefaultApi(configuration);
      this._initialized = true;
    } catch (e) {
      this._initialized = false;
      ConduitGrpcSdk.Logger.error('Failed to initialize OneSignal');
    }
  }
}
