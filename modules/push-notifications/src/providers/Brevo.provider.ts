import { BaseNotificationProvider } from './base.provider.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { IBrevoSettings } from '../interfaces/IBrevoSettings.js';
import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../interfaces/ISendNotification.js';

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
      this.apiUrl = settings.apiUrl;
      this.accessToken = settings.accessToken;
      this._initialized = true;
      ConduitGrpcSdk.Logger.log('Brevo (WonderPush) Provider initialized successfully.');
    } catch (e) {
      this._initialized = false;
      ConduitGrpcSdk.Logger.error(`Failed to initialize Brevo: ${(e as Error).message}`);
    }
  }

  private async ensureUserExists(userId: string): Promise<boolean> {
    try {
      const userResponse = await fetch(`${this.apiUrl}/users/${userId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (userResponse.ok) {
        return true;
      }
    } catch (error) {
      ConduitGrpcSdk.Logger.error(`Error checking user in Brevo:`);
    }

    try {
      const createUserResponse = await fetch(`${this.apiUrl}/users/${userId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: this.accessToken,
          overwrite: false,
          body: {
            custom: { string_foo: 'bar' },
          },
        }),
      });

      if (!createUserResponse.ok) {
        ConduitGrpcSdk.Logger.error(`Failed to create user in Brevo.`);
        return false;
      }

      return true;
    } catch (error) {
      ConduitGrpcSdk.Logger.error(`Error creating user in Brevo:`);
      return false;
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

    const userReady = await this.ensureUserExists(userId);
    if (!userReady) {
      ConduitGrpcSdk.Logger.error(`User ${userId} could not be created or verified`);
      return;
    }

    const message = params.body ?? 'ok';

    try {
      const notificationResponse = await fetch(`${this.apiUrl}/deliveries`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: this.accessToken,
          targetUserIds: [userId],
          notification: { message },
        }),
      });

      if (!notificationResponse.ok) {
        const errorData = await notificationResponse.json();
        ConduitGrpcSdk.Logger.error(
          `Error sending notification to user ${userId}: ${JSON.stringify(errorData)}`,
        );
        return;
      }

      await notificationResponse.json();
    } catch (error) {
      ConduitGrpcSdk.Logger.error(
        `Unexpected error while sending notification: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
