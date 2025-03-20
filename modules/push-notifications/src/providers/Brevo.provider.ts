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

  /**
   * Ensure the user exists in Brevo(WonderPush), if they don't, create them using userId.
   */
  private async ensureUserExists(userId: string): Promise<boolean> {
    ConduitGrpcSdk.Logger.log(`Checking if user exists in Brevo: ${userId}...`);

    try {
      const userResponse = await fetch(`${this.apiUrl}/users/${userId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (userResponse.ok) {
        ConduitGrpcSdk.Logger.log(`User ${userId} already exists.`);
        return true;
      }
    } catch (error) {
      ConduitGrpcSdk.Logger.error(`Error checking user in Brevo:`);
    }

    ConduitGrpcSdk.Logger.log(`Creating user ${userId} in Brevo...`);

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

      ConduitGrpcSdk.Logger.log(`User ${userId} created successfully.`);
      return true;
    } catch (error) {
      ConduitGrpcSdk.Logger.error(`Error creating user in Brevo:`);
      return false;
    }
  }

  /**
   * Sends a push notification via Brevo (WonderPush).
   */
  async sendMessage(
    token: string | string[],
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<void> {
    ConduitGrpcSdk.Logger.log(`Received request:`, JSON.stringify(params, null, 2));

    const userId = params.sendTo;

    if (!userId) {
      ConduitGrpcSdk.Logger.error(`Missing userId in request`);
      return;
    }

    ConduitGrpcSdk.Logger.log(`Extracted userId: ${userId}`);

    const message = params.body ?? 'ok'; // Default message if none provided

    ConduitGrpcSdk.Logger.log(`Sending push notification to user ${userId}...`);

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
          notification: { message: message },
        }),
      });

      if (!notificationResponse.ok) {
        const errorData = await notificationResponse.json();
        ConduitGrpcSdk.Logger.error(
          `Error sending notification to user ${userId}: ${JSON.stringify(errorData)}`,
        );
        return;
      }

      const responseData = await notificationResponse.json();
      ConduitGrpcSdk.Logger.log(
        `Notification sent successfully: ${JSON.stringify(responseData)}`,
      );
    } catch (error) {
      ConduitGrpcSdk.Logger.error(
        `Unexpected error while sending notification: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
