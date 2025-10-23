import {
  SNSClient,
  CreatePlatformEndpointCommand,
  PublishCommand,
} from '@aws-sdk/client-sns';
import { BaseNotificationProvider } from './base.provider.js';
import { ConduitGrpcSdk, PlatformTypesEnum } from '@conduitplatform/grpc-sdk';
import {
  ISendNotification,
  ISendNotificationToManyDevices,
} from '../interfaces/ISendNotification.js';
import { IAmazonSNSSettings } from '../interfaces/IAmazonSNSSettings.js';
import { NotificationToken } from '../models/index.js';

// Mapping between Conduit platforms and AWS SNS message types
const CONDUIT_TO_AWS_PLATFORM: Partial<Record<PlatformTypesEnum, 'GCM' | 'APNS'>> = {
  [PlatformTypesEnum.ANDROID]: 'GCM',
  [PlatformTypesEnum.IOS]: 'APNS',
};

export class AmazonSNSProvider extends BaseNotificationProvider<IAmazonSNSSettings> {
  private snsClient: SNSClient;
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

      this.snsClient = new SNSClient({
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
      throw e;
    }
  }

  async registerDeviceToken(token: string, platform: PlatformTypesEnum): Promise<string> {
    // Get the appropriate application ARN based on platform
    const applicationArn =
      platform === PlatformTypesEnum.ANDROID
        ? this.settings.gcmApplicationArn
        : this.settings.apnsApplicationArn;

    if (!applicationArn) {
      throw new Error(
        `Only ANDROID (GCM) and IOS (APNS) platforms are supported: ${platform}`,
      );
    }

    let endpointResponse;
    try {
      const command = new CreatePlatformEndpointCommand({
        PlatformApplicationArn: applicationArn,
        Token: token,
      });

      endpointResponse = await this.snsClient.send(command);
    } catch (error) {
      ConduitGrpcSdk.Logger.error(
        `Failed to register the device token at Amazon SNS: ${(error as Error).message}`,
      );
      throw error;
    }

    // Update the existing token entry with the new ARN
    await NotificationToken.getInstance().updateOne(
      { token: token },
      { token: endpointResponse.EndpointArn as string },
    );

    return endpointResponse.EndpointArn as string;
  }

  async sendMessage(
    token: string,
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<void | string> {
    const { title, body, data, isSilent = false, platform } = params;

    // Get the AWS platform type for the message structure
    const awsPlatform = CONDUIT_TO_AWS_PLATFORM[platform as PlatformTypesEnum];
    if (!awsPlatform) {
      throw new Error(
        `Unsupported platform for AWS SNS, use ANDROID or IOS: ${platform}`,
      );
    }

    // Message payload
    const message: Record<string, string> = {
      default: JSON.stringify({ title, body, data }),
    };

    if (awsPlatform === 'GCM') {
      message[awsPlatform] = JSON.stringify(
        isSilent
          ? {
              data: { ...data },
            }
          : {
              notification: { title, body },
              data: { ...data },
            },
      );
    } else if (awsPlatform === 'APNS') {
      message[awsPlatform] = JSON.stringify(
        isSilent
          ? {
              aps: { 'content-available': 1 },
              ...data,
            }
          : {
              aps: {
                alert: { title, body },
                sound: 'default',
                'content-available': 0,
              },
              ...data,
            },
      );
    }

    // Sending the message.
    try {
      const command = new PublishCommand({
        TargetArn: token, // Using the registered token directly
        Message: JSON.stringify(message),
        MessageStructure: 'json',
      });

      const response = await this.snsClient.send(command);

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
