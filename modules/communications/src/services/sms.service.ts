import { SmsRecord } from '../models/index.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import { channelFailure } from '../utils/channelFailure.js';
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
import { MockSmsProvider } from '../providers/sms/mock.js';

export class SmsService implements IChannel {
  private provider?: ISmsProvider;
  private providerName?: string;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  public async initSmsProvider(config: Config) {
    const smsConfig = config.sms;

    if (!smsConfig || !smsConfig.providerName) {
      ConduitGrpcSdk.Logger.warn('SMS not configured');
      return;
    }
    if (!smsConfig.active) {
      this.provider = undefined;
      this.providerName = undefined;
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
        case 'mock':
          this.provider = new MockSmsProvider();
          break;
        default:
          ConduitGrpcSdk.Logger.error(`Unknown SMS provider: ${name}`);
      }
      if (this.provider) {
        this.providerName = name;
      }
    } catch (e) {
      this.provider = undefined;
      this.providerName = undefined;
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
        throw new ModuleError(errors.SMS_NOT_CONFIGURED);
      }

      const result = await this.provider
        .sendSms(recipient, body || '')
        .catch(ModuleError.rethrow(errors.SMS_PROVIDER_ERROR));

      // Store SMS record if needed
      const smsRecord = await SmsRecord.getInstance().create({
        recipient,
        message: body || '',
        provider: this.providerName ?? 'unknown',
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
        ...channelFailure(error, errors.SMS_PROVIDER_ERROR),
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
      const smsRecord = await SmsRecord.getInstance().findOne(
        { _id: messageId },
        { readPreference: 'primary' },
      );
      if (!smsRecord) {
        return {
          status: 'failed' as const,
          messageId,
          error: errors.SMS_RECORD_NOT_FOUND.message,
          conduitCode: errors.SMS_RECORD_NOT_FOUND.conduitCode,
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
        ...channelFailure(error, errors.COMMUNICATIONS_DATABASE_ERROR),
        timestamp: new Date(),
      };
    }
  }

  async sendSms(to: string, message: string) {
    if (!this.provider) {
      throw new ModuleError(errors.SMS_NOT_CONFIGURED);
    }

    const result = await this.provider
      .sendSms(to, message)
      .catch(ModuleError.rethrow(errors.SMS_PROVIDER_ERROR));

    // Store SMS record
    const smsRecord = await SmsRecord.getInstance()
      .create({
        recipient: to,
        message,
        provider: this.providerName ?? 'unknown',
        status: 'sent',
        providerResponse: result,
      })
      .catch(ModuleError.rethrow(errors.COMMUNICATIONS_DATABASE_ERROR));

    return { messageId: smsRecord._id, ...result };
  }

  async sendVerificationCode(to: string) {
    if (!this.provider) {
      throw new ModuleError(errors.SMS_NOT_CONFIGURED);
    }

    const verificationSid = await this.provider
      .sendVerificationCode(to)
      .catch(ModuleError.rethrow(errors.SMS_PROVIDER_ERROR));
    return { verificationSid };
  }

  async verify(verificationSid: string, code: string) {
    if (!this.provider) {
      throw new ModuleError(errors.SMS_NOT_CONFIGURED);
    }

    const verified = await this.provider
      .verify(verificationSid, code)
      .catch(ModuleError.rethrow(errors.SMS_PROVIDER_ERROR));
    return { verified };
  }
}
