import AWS from 'aws-sdk';
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
      throw e;
    }
  }

  //Handles the registration of a device token to an endpoint ARN and stores the new token in the database
  async registerDeviceToken(token: string, platform: PlatformTypesEnum): Promise<string> {
    if (!this._initialized) {
      throw new Error('Amazon SNS Provider is not initialized.');
    }

    try {
      // Get the appropriate application ARN based on platform
      const applicationArn =
        platform === PlatformTypesEnum.ANDROID
          ? this.settings.gcmApplicationArn
          : this.settings.apnsApplicationArn;

      if (!applicationArn) {
        throw new Error(`Missing platform application ARN for platform: ${platform}`);
      }

      const endpointResponse = await this.sns
        .createPlatformEndpoint({
          PlatformApplicationArn: applicationArn,
          Token: token,
        })
        .promise();

      if (!endpointResponse.EndpointArn) {
        throw new Error('Failed to create platform endpoint: No ARN returned');
      }

      // Update the existing token entry with the new ARN
      await NotificationToken.getInstance().updateOne(
        { token: token },
        { token: endpointResponse.EndpointArn },
      );

      return endpointResponse.EndpointArn;
    } catch (error) {
      ConduitGrpcSdk.Logger.error(`Failed to register device token: ${error}`);
      throw error;
    }
  }

  async sendMessage(
    token: string,
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<void | string> {
    if (!this._initialized) {
      throw new Error('Amazon SNS Provider is not initialized.');
    }

    try {
      const { title, body, data, isSilent = false, platform } = params;

      if (!title || !body) {
        throw new Error('Title and body are required for notifications');
      }

      // Use registerDeviceToken function to get the endpoint ARN
      const endpointArn = await this.registerDeviceToken(
        token,
        platform as PlatformTypesEnum,
      );

      // Get the AWS platform type for the message structure
      const awsPlatform = CONDUIT_TO_AWS_PLATFORM[platform as PlatformTypesEnum];
      if (!awsPlatform) {
        throw new Error(`Unsupported platform for AWS SNS: ${platform}`);
      }

      // Message payload
      const message = {
        default: JSON.stringify({ title, body, data }),
        [awsPlatform]: JSON.stringify(
          awsPlatform === 'GCM'
            ? {
                notification: { title, body },
                data: {
                  ...data,
                  silent: isSilent ? 'true' : 'false',
                },
              }
            : {
                aps: {
                  alert: { title, body },
                  ...(isSilent ? {} : { sound: 'default' }),
                  'content-available': isSilent ? 1 : 0,
                },
                ...data,
              },
        ),
      };

      // Sending the message.
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
