import { isNil } from 'lodash-es';
import { SmsRecord } from '../models/index.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { IChannel, IChannelSendParams, ChannelResult } from '../interfaces/index.js';
import { ISmsProvider } from '../providers/sms/interfaces/ISmsProvider.js';

export class SmsService implements IChannel {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private provider: ISmsProvider,
  ) {}

  updateProvider(provider: ISmsProvider) {
    this.provider = provider;
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

  async getStatus(
    messageId: string,
  ): Promise<{ status: string; messageId: string; timestamp?: Date; error?: string }> {
    try {
      const smsRecord = await SmsRecord.getInstance().findOne({ _id: messageId });
      if (!smsRecord) {
        return {
          status: 'not_found',
          messageId,
          error: 'SMS record not found',
          timestamp: new Date(),
        };
      }

      return {
        status: smsRecord.status,
        messageId,
        timestamp: smsRecord.updatedAt,
      };
    } catch (error) {
      return {
        status: 'failed',
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
