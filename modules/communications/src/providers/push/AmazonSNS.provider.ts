import {
  CreatePlatformEndpointCommand,
  PublishCommand,
  SNSClient,
} from '@aws-sdk/client-sns';
import { BaseNotificationProvider } from './base.provider.js';
import { ConduitGrpcSdk, PlatformTypesEnum } from '@conduitplatform/grpc-sdk';
import { IAmazonSNSSettings } from '../../interfaces/index.js';
import { NotificationToken } from '../../models/index.js';
import {
  IPushBatchResult,
  IPushSendFailure,
  IPushTokenTarget,
  ISendNotification,
  ISendNotificationToManyDevices,
} from './interfaces/index.js';

// Mapping between Conduit platforms and AWS SNS message types
const CONDUIT_TO_AWS_PLATFORM: Partial<Record<PlatformTypesEnum, 'GCM' | 'APNS'>> = {
  [PlatformTypesEnum.ANDROID]: 'GCM',
  [PlatformTypesEnum.IOS]: 'APNS',
};

const SNS_SEND_CONCURRENCY = 10;

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

    await NotificationToken.getInstance().updateOne(
      { token: token },
      { token: endpointResponse.EndpointArn as string },
    );

    return endpointResponse.EndpointArn as string;
  }

  private isPermanentSnsEndpointError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const err = error as {
      name?: string;
      Code?: string;
      code?: string;
      message?: string;
    };
    const name = err.name ?? '';
    const code = String(err.Code ?? err.code ?? '');

    if (
      name === 'EndpointDisabledException' ||
      code === 'EndpointDisabled' ||
      name === 'EndpointDisabled'
    ) {
      return true;
    }

    if (name === 'NotFoundException' || code === 'NotFound' || name === 'NotFound') {
      return true;
    }

    if (
      name === 'InvalidParameterException' ||
      code === 'InvalidParameter' ||
      name === 'InvalidParameter'
    ) {
      const message = String(err.message ?? '').toLowerCase();
      return (
        message.includes('endpoint') &&
        (message.includes('not found') ||
          message.includes('does not exist') ||
          message.includes('invalid') ||
          message.includes('disabled'))
      );
    }

    return false;
  }

  private async deleteToken(token: string): Promise<void> {
    await NotificationToken.getInstance().deleteOne({ token });
  }

  async sendMessage(
    token: string,
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<void | string> {
    const { title, body, data, isSilent = false, platform } = params;

    const awsPlatform = CONDUIT_TO_AWS_PLATFORM[platform as PlatformTypesEnum];
    if (!awsPlatform) {
      throw new Error(
        `Unsupported platform for AWS SNS, use ANDROID or IOS: ${platform}`,
      );
    }

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

    try {
      const command = new PublishCommand({
        TargetArn: token,
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

  async sendMessages(
    targets: IPushTokenTarget[],
    params: ISendNotification | ISendNotificationToManyDevices,
  ): Promise<IPushBatchResult> {
    const failures: IPushSendFailure[] = [];
    const deletePromises: Promise<void>[] = [];
    let successCount = 0;

    for (let i = 0; i < targets.length; i += SNS_SEND_CONCURRENCY) {
      const chunk = targets.slice(i, i + SNS_SEND_CONCURRENCY);
      await Promise.all(
        chunk.map(async target => {
          try {
            await this.sendMessage(target.token, {
              ...params,
              platform: params.platform ?? target.platform,
            });
            successCount++;
          } catch (error) {
            failures.push({
              token: target.token,
              platform: target.platform,
              error,
            });
            if (this.isPermanentSnsEndpointError(error)) {
              deletePromises.push(this.deleteToken(target.token));
            }
          }
        }),
      );
    }

    await Promise.all(deletePromises);

    return {
      successCount,
      failureCount: failures.length,
      failures,
    };
  }
}
