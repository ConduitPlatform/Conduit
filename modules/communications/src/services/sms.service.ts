import { SmsRecord } from '../models/index.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import {
  ChannelResult,
  ChannelStatus,
  IChannel,
  IChannelSendParams,
} from '../interfaces/index.js';
import { ISmsProvider } from '../providers/sms/interfaces/ISmsProvider.js';
import { Config } from '../config/index.js';
import { messageBirdProvider } from '../providers/sms/messageBird.js';
import { AwsSnsProvider } from '../providers/sms/awsSns.js';
import { TwilioProvider } from '../providers/sms/twilio.js';

export class SmsService implements IChannel {
  private provider?: ISmsProvider;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  public async initSmsProvider(config: Config) {
    const smsConfig = config.sms;

    if (!smsConfig || !smsConfig.providerName) {
      ConduitGrpcSdk.Logger.warn('SMS not configured');
      return;
    }
    if (!smsConfig.active) {
      this.provider = undefined;
      return;
    }

    const name = smsConfig.providerName;
    const settings = (smsConfig as any)[name];

    try {
      switch (name) {
        case 'twilio':
          this.provider = new TwilioProvider(settings);
          break;
        case 'awsSns':
          this.provider = new AwsSnsProvider(settings, this.grpcSdk);
          break;
        case 'messageBird':
          this.provider = new messageBirdProvider(settings);
          break;
        default:
          ConduitGrpcSdk.Logger.error(`Unknown SMS provider: ${name}`);
      }
    } catch (e) {
      this.provider = undefined;
      ConduitGrpcSdk.Logger.error('Failed to initialize SMS provider:', e);
    }
  }
  isAvailable(): boolean {
    return !!this.provider;
  }

  async send(params: IChannelSendParams): Promise<ChannelResult> {
    try {
      const { recipient, body } = params;

      if (!this.provider) {
        throw new Error('No SMS provider available');
      }

      const result = await this.provider.sendSms(recipient, body || '');

      // Store SMS record if needed
      const smsRecord = await SmsRecord.getInstance().create({
        recipient,
        message: body || '',
        provider: 'unknown', // This should be determined from the provider
        status: 'sent',
        providerResponse: result,
      });

      return {
        success: true,
        messageId: smsRecord._id,
        channel: 'sms',
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        channel: 'sms',
      };
    }
  }

  async sendMany(params: IChannelSendParams[]): Promise<ChannelResult[]> {
    const results: ChannelResult[] = [];

    for (const param of params) {
      const result = await this.send(param);
      results.push(result);
    }

    return results;
  }

  async getStatus(messageId: string): Promise<ChannelStatus> {
    try {
      const smsRecord = await SmsRecord.getInstance().findOne({ _id: messageId });
      if (!smsRecord) {
        return {
          status: 'failed' as const,
          messageId,
          error: 'SMS record not found',
          timestamp: new Date(),
        };
      }

      return {
        status:
          (smsRecord.status as 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced') ||
          ('sent' as const),
        messageId,
        timestamp: smsRecord.updatedAt,
      };
    } catch (error) {
      return {
        status: 'failed' as const,
        messageId,
        error: (error as Error).message,
        timestamp: new Date(),
      };
    }
  }

  async sendSms(to: string, message: string) {
    if (!this.provider) {
      throw new Error('No SMS provider available');
    }

    const result = await this.provider.sendSms(to, message);

    // Store SMS record
    const smsRecord = await SmsRecord.getInstance().create({
      recipient: to,
      message,
      provider: 'unknown', // This should be determined from the provider
      status: 'sent',
      providerResponse: result,
    });

    return { messageId: smsRecord._id, ...result };
  }

  async sendVerificationCode(to: string) {
    if (!this.provider) {
      throw new Error('No SMS provider available');
    }

    const verificationSid = await this.provider.sendVerificationCode(to);
    return { verificationSid };
  }

  async verify(verificationSid: string, code: string) {
    if (!this.provider) {
      throw new Error('No SMS provider available');
    }

    const verified = await this.provider.verify(verificationSid, code);
    return { verified };
  }
}
