import AWS from 'aws-sdk';
import { BaseNotificationProvider } from './base.provider.js';
import { ConduitGrpcSdk, PlatformTypesEnum } from '@conduitplatform/grpc-sdk';
import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../interfaces/ISendNotification.js';
import { IAmazonSNSSettings } from '../interfaces/IAmazonSNSSettings.js';

// Static mapping between AWS SNS platforms and Conduit platforms
const AWS_TO_CONDUIT_PLATFORM_MAP: Record<string, PlatformTypesEnum> = {
  GCM: PlatformTypesEnum.ANDROID, // Google Cloud Messaging (Android)
  APNS: PlatformTypesEnum.IOS, // Apple Push Notification Service (iOS)
  APNS_SANDBOX: PlatformTypesEnum.IOS, // APNS Sandbox (iOS development)
  APNS_VOIP: PlatformTypesEnum.IOS, // APNS VoIP
  APNS_VOIP_SANDBOX: PlatformTypesEnum.IOS, // APNS VoIP Sandbox
  ADM: PlatformTypesEnum.ANDROID, // Amazon Device Messaging (Android)
  BAIDU: PlatformTypesEnum.ANDROID, // Baidu Cloud Push (Android)
  WNS: PlatformTypesEnum.WINDOWS, // Windows Push Notification Service
  MPNS: PlatformTypesEnum.WINDOWS, // Microsoft Push Notification Service
};

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

  async sendMessage(
    deviceToken: string,
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<void | string> {
    if (!this._initialized) {
      throw new Error('Amazon SNS Provider is not initialized.');
    }

    try {
      const { title, body, data, isSilent, platform } = params;

      // Convert platform string to PlatformTypesEnum
      const platformEnum = platform as PlatformTypesEnum;

      // Find the AWS platform that corresponds to the Conduit platform
      const awsPlatform = Object.entries(AWS_TO_CONDUIT_PLATFORM_MAP).find(
        ([_, conduitPlatform]) => conduitPlatform === platformEnum,
      )?.[0];

      if (!awsPlatform) {
        throw new Error(`Unsupported platform for AWS SNS: ${platform}`);
      }

      if (!this.settings.platformApplications[awsPlatform]) {
        throw new Error(`Missing platform application ARN for platform: ${awsPlatform}`);
      }

      // Create endpoint ARN for this device token
      const endpointResponse = await this.sns
        .createPlatformEndpoint({
          PlatformApplicationArn: this.settings.platformApplications[awsPlatform],
          Token: deviceToken,
        })
        .promise();

      const endpointArn = endpointResponse.EndpointArn;

      const message = {
        default: JSON.stringify({ title, body, data }),
        GCM: JSON.stringify({
          notification: { title, body },
          data: {
            ...data,
            silent: isSilent ? 'true' : 'false',
          },
        }),
        APNS: JSON.stringify({
          aps: {
            alert: { title, body },
            sound: isSilent ? null : 'default',
            badge: 1,
            'content-available': isSilent ? 1 : 0,
          },
          ...data,
        }),
        APNS_SANDBOX: JSON.stringify({
          aps: {
            alert: { title, body },
            sound: isSilent ? null : 'default',
            badge: 1,
            'content-available': isSilent ? 1 : 0,
          },
          ...data,
        }),
        WNS: JSON.stringify({
          notification: {
            title,
            body,
            ...data,
            silent: isSilent ? 'true' : 'false',
          },
        }),
      };

      // Send to specific endpoint using the endpoint ARN
      const response = await this.sns
        .publish({
          TargetArn: endpointArn,
          Message: JSON.stringify(message),
          MessageStructure: 'json',
        })
        .promise();

      if (!response.MessageId) {
        throw new Error('Failed to send notification: No message ID returned');
      }

      return response.MessageId;
    } catch (error) {
      ConduitGrpcSdk.Logger.error(`Failed to send SNS message: ${error}`);
      throw error;
    }
  }
}
