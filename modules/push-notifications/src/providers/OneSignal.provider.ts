import { BaseNotificationProvider } from './base.provider.js';
import { IOneSignalSettings } from '../interfaces/IOneSignalSettings.js';
import {
  IPushBatchResult,
  IPushSendFailure,
  IPushTokenTarget,
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../interfaces/ISendNotification.js';
import { createConfiguration, DefaultApi, Notification } from '@onesignal/node-onesignal';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { NotificationToken } from '../models/index.js';

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
    playerIds: string[],
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Notification {
    const { title, body, data } = params;
    if (params.isSilent) {
      return {
        content_available: true,
        app_id: this.appId,
        data: { ...data },
        include_player_ids: playerIds,
      };
    }
    return {
      app_id: this.appId,
      contents: { en: body ?? '' },
      headings: { en: title },
      data: { ...data },
      include_player_ids: playerIds,
    };
  }

  private async cleanupInvalidPlayerIds(invalidPlayerIds: string[]): Promise<void> {
    if (invalidPlayerIds.length === 0) return;
    await NotificationToken.getInstance().deleteMany({
      token: { $in: invalidPlayerIds },
    });
  }

  async sendMessage(
    token: string | string[],
    params: ISendNotification | ISendNotificationToManyDevices,
  ) {
    const playerIds = Array.isArray(token) ? token : [token];
    const response = await this.client!.createNotification(
      this.buildNotification(playerIds, params),
    );
    await this.cleanupInvalidPlayerIds(response.errors?.invalid_player_ids ?? []);
    return;
  }

  async sendMessages(
    targets: IPushTokenTarget[],
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<IPushBatchResult> {
    const playerIds = targets.map(target => target.token);
    try {
      const response = await this.client!.createNotification(
        this.buildNotification(playerIds, params),
      );
      const invalidPlayerIds = new Set(response.errors?.invalid_player_ids ?? []);
      await this.cleanupInvalidPlayerIds([...invalidPlayerIds]);

      const failures: IPushSendFailure[] = targets
        .filter(target => invalidPlayerIds.has(target.token))
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
    const app_key_provider: { getToken(): string } = {
      getToken(): string {
        return settings.apiKey;
      },
    };
    const configuration = createConfiguration({
      authMethods: {
        app_key: {
          tokenProvider: app_key_provider,
        },
      },
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
