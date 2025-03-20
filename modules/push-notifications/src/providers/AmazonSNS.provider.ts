import AWS from 'aws-sdk';
import { BaseNotificationProvider } from './base.provider.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../interfaces/ISendNotification.js';
import { IAmazonSNSSettings } from '../interfaces/IAmazonSNSSettings.js';

export class AmazonSNSProvider extends BaseNotificationProvider<IAmazonSNSSettings> {
  private sns: AWS.SNS;

  constructor(settings: IAmazonSNSSettings) {
    super();
    this._initialized = false;
    this.isBaseProvider = false;
    this.updateProvider(settings);
  }

  updateProvider(settings: IAmazonSNSSettings) {
    try {
      this.sns = new AWS.SNS({
        credentials: {
          accessKeyId: settings.accessKeyId,
          secretAccessKey: settings.secretAccessKey,
        },
        region: settings.region,
      });
      this._initialized = true;
      ConduitGrpcSdk.Logger.log('Amazon SNS Provider initialized successfully.');
    } catch (e) {
      this._initialized = false;
      ConduitGrpcSdk.Logger.error(
        `Failed to initialize Amazon SNS: ${(e as Error).message}`,
      );
    }
  }

  /**
   * Register a device token with AWS SNS and return the SNS Endpoint ARN.
   * Does not store the ARN in the database.
   */
  async registerDeviceToken(deviceToken: string): Promise<string | undefined> {
    if (!this._initialized) {
      throw new Error('Amazon SNS Provider is not initialized.');
    }

    try {
      const platformArn = process.env.AWS_PLATFORM_ARN;
      if (!platformArn) {
        throw new Error('AWS_PLATFORM_ARN is missing.');
      }

      console.log('Registering token with AWS SNS...');
      console.log(`Platform ARN: ${platformArn}`);
      console.log(`Device Token: ${deviceToken}`);

      const response = await this.sns
        .createPlatformEndpoint({
          PlatformApplicationArn: platformArn,
          Token: deviceToken,
        })
        .promise();

      console.log(
        `Successfully registered device. SNS Endpoint ARN: ${response.EndpointArn}`,
      );
      return response.EndpointArn;
    } catch (error) {
      console.error('AWS SNS Error:', error);
      return undefined;
    }
  }

  /**
   * Send a push notification using AWS SNS.
   * If the provided token is not an SNS ARN, it will create a temporary ARN and send the message.
   */
  async sendMessage(
    token: string,
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<void | string> {
    if (!this._initialized) {
      throw new Error('Amazon SNS Provider is not initialized.');
    }

    const { title, body, data } = params;

    try {
      let snsEndpointArn: string | undefined = token;

      // Step 1: If token is NOT an ARN, register it first (This is for future DB support of ARN tokens, we can delete this segment for now / token is always !ARN)
      if (!token.startsWith('arn:aws:sns:')) {
        console.log(
          `Creating temporary SNS Platform Endpoint for device token: ${token}`,
        );

        snsEndpointArn = await this.registerDeviceToken(token);

        if (!snsEndpointArn) {
          throw new Error('Failed to create SNS endpoint ARN.');
        }

        console.log(`Temporary SNS Endpoint ARN created: ${snsEndpointArn}`);
      }

      // Step 2: Send the Push Notification
      console.log(`Sending SNS notification to ARN: ${snsEndpointArn}`);

      const messagePayload = {
        default: body,
        APNS: JSON.stringify({ aps: { alert: { title, body }, data } }),
        GCM: JSON.stringify({ notification: { title, body }, data }),
      };

      const response = await this.sns
        .publish({
          Message: JSON.stringify(messagePayload),
          MessageStructure: 'json',
          TargetArn: snsEndpointArn,
        })
        .promise();

      console.log(`SNS Notification sent! Message ID: ${response.MessageId}`);
      return response.MessageId || 'Success';
    } catch (e) {
      console.error(`Failed to send SNS notification: ${(e as Error).message}`);

      if (
        (e as Error).message.includes('EndpointDisabled') ||
        (e as Error).message.includes('InvalidParameter')
      ) {
        console.warn(`SNS Endpoint ARN was invalid: ${token}`);
      }
      return;
    }
  }
}
