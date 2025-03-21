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
  private settings: IAmazonSNSSettings;

  constructor(settings: IAmazonSNSSettings) {
    super();
    this._initialized = false;
    this.isBaseProvider = false;
    this.updateProvider(settings);
  }

  updateProvider(settings: IAmazonSNSSettings) {
    try {
      this.settings = settings;

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

  private resolvePlatformKey(data?: Record<string, any>): string {
    const platforms = Object.keys(this.settings.platformApplications || {});
    let platform = data?.snsPlatform;

    if (!platform) {
      if (platforms.length === 1) {
        platform = platforms[0]; // Use the only available platform
      } else {
        throw new Error(
          'Missing snsPlatform in data. Multiple platform ARNs are configured — please specify data.snsPlatform.',
        );
      }
    }

    const platformArn = this.settings.platformApplications?.[platform];
    if (!platformArn) {
      throw new Error(`Platform ARN for "${platform}" not found in config.`);
    }

    return platform;
  }

  async registerDeviceToken(
    deviceToken: string,
    platform: string,
  ): Promise<string | undefined> {
    if (!this._initialized) {
      throw new Error('Amazon SNS Provider is not initialized.');
    }

    try {
      const platformArn = this.settings.platformApplications?.[platform];
      if (!platformArn) {
        throw new Error(`Missing platform ARN for ${platform} in config.`);
      }

      const response = await this.sns
        .createPlatformEndpoint({
          PlatformApplicationArn: platformArn,
          Token: deviceToken,
        })
        .promise();

      return response.EndpointArn;
    } catch (error) {
      ConduitGrpcSdk.Logger.error(`Failed to register SNS device token: ${error}`);
      return undefined;
    }
  }

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

      if (!token.startsWith('arn:aws:sns:')) {
        const platform = this.resolvePlatformKey(data);

        snsEndpointArn = await this.registerDeviceToken(token, platform);
        if (!snsEndpointArn) {
          throw new Error('Failed to create SNS endpoint ARN.');
        }
      }

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

      return response.MessageId || 'Success';
    } catch (e) {
      ConduitGrpcSdk.Logger.error(
        `Failed to send SNS notification: ${(e as Error).message}`,
      );
      return;
    }
  }
}
