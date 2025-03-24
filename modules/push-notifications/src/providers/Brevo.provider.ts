import { BaseNotificationProvider } from './base.provider.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../interfaces/ISendNotification.js';
import { IBrevoSettings } from '../interfaces/IBrevoSettings.js';
import axios from 'axios';

export class BrevoProvider extends BaseNotificationProvider<IBrevoSettings> {
  private apiUrl: string;
  private accessToken: string;

  constructor(settings: IBrevoSettings) {
    super();
    this._initialized = false;
    this.isBaseProvider = false;
    this.updateProvider(settings);
  }

  updateProvider(settings: IBrevoSettings) {
    try {
      this.accessToken = settings.accessToken;
      this.apiUrl = settings.apiUrl;
      this._initialized = true;
      ConduitGrpcSdk.Logger.log('Brevo (WonderPush) Provider initialized successfully.');
    } catch (e) {
      this._initialized = false;
      ConduitGrpcSdk.Logger.error(`Failed to initialize Brevo: ${(e as Error).message}`);
    }
  }

  async sendMessage(
    token: string | string[],
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<void> {
    const userId = params.sendTo;

    if (!userId || Array.isArray(userId)) {
      ConduitGrpcSdk.Logger.error(`Invalid or missing userId in request`);
      return;
    }

    try {
      const notificationPayload = {
        targetUserIds: userId,
        notifications: [
          {
            title: params.title,
            text: params.body,
            custom: {
              ...params.data,
            },
            ...(params.isSilent && { silent: true }),
            ...(!params.isSilent && { sound: 'default' }),
          },
        ],
      };

      const notificationResponse = await axios.post(
        `${this.apiUrl}/deliveries?accessToken=${this.accessToken}`,
        notificationPayload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (notificationResponse.status !== 200) {
        ConduitGrpcSdk.Logger.error(
          `Error sending notification to user ${userId}: ${JSON.stringify(
            notificationResponse.data,
          )}`,
        );
        return;
      }

      ConduitGrpcSdk.Logger.log(`Successfully sent notification to user ${userId}`);
    } catch (error) {
      ConduitGrpcSdk.Logger.error(`Failed to send Brevo notification: ${error}`);
      throw error;
    }
  }
}
