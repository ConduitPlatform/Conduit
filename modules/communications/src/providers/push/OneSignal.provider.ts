import { BaseNotificationProvider } from './base.provider.js';
import { createConfiguration, DefaultApi, Notification } from '@onesignal/node-onesignal';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { IOneSignalSettings } from '../../interfaces/index.js';
import {
  IPushBatchResult,
  IPushSendFailure,
  IPushTokenTarget,
  ISendNotification,
  ISendNotificationToManyDevices,
} from './interfaces/index.js';
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

  protected getSendChunkSize(): number {
    return 2000;
  }

  private buildNotification(
    subscriptionIds: string[],
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Notification {
    const { title, body, data } = params;
    if (params.isSilent) {
      return {
        content_available: true,
        app_id: this.appId,
        data: { ...data },
        include_subscription_ids: subscriptionIds,
      };
    }
    return {
      app_id: this.appId,
      contents: { en: body ?? '' },
      headings: { en: title },
      data: { ...data },
      include_subscription_ids: subscriptionIds,
    };
  }

  private async cleanupInvalidSubscriptionIds(invalidIds: string[]): Promise<void> {
    if (invalidIds.length === 0) return;
    await NotificationToken.getInstance().deleteMany({
      token: { $in: invalidIds },
    });
  }

  async sendMessage(
    token: string | string[],
    params: ISendNotification | ISendNotificationToManyDevices,
  ) {
    const subscriptionIds = Array.isArray(token) ? token : [token];
    const response = await this.client!.createNotification(
      this.buildNotification(subscriptionIds, params),
    );
    await this.cleanupInvalidSubscriptionIds(response.errors?.invalid_player_ids ?? []);
    return;
  }

  async sendMessages(
    targets: IPushTokenTarget[],
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<IPushBatchResult> {
    const subscriptionIds = targets.map(target => target.token);
    try {
      const response = await this.client!.createNotification(
        this.buildNotification(subscriptionIds, params),
      );
      const invalidIds = new Set<string>(response.errors?.invalid_player_ids ?? []);
      await this.cleanupInvalidSubscriptionIds([...invalidIds]);

      const failures: IPushSendFailure[] = targets
        .filter(target => invalidIds.has(target.token))
        .map(target => ({
          token: target.token,
          platform: target.platform,
          reason: 'invalid_player_id',
        }));

      return {
        successCount: targets.length - failures.length,
        failureCount: failures.length,
        failures,
      };
    } catch (error) {
      return {
        successCount: 0,
        failureCount: targets.length,
        failures: targets.map(target => ({
          token: target.token,
          platform: target.platform,
          error,
        })),
      };
    }
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
