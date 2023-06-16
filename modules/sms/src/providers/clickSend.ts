import { ISmsProvider } from '../interfaces/ISmsProvider';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { SMSApi, SmsMessage, SmsMessageCollection } from 'clicksend';
import { generate } from 'otp-generator';

export class clickSendProvider implements ISmsProvider {
  private readonly username: string;
  private readonly clicksendApiKey: string;
  private client: SMSApi;
  private grpcSdk: ConduitGrpcSdk;
  constructor(
    settings: {
      username: string;
      clicksendApiKey: string;
    },
    grpcSdk: ConduitGrpcSdk,
  ) {
    ({ username: this.username, clicksendApiKey: this.clicksendApiKey } = settings);
    this.client = new SMSApi(this.username, this.clicksendApiKey);
    this.grpcSdk = grpcSdk;
  }

  async sendSms(phoneNumber: string, message: string) {
    const smsMessage: SmsMessage = {
      body: message,
      to: phoneNumber,
    };
    const smsMessageCollection: SmsMessageCollection = {
      messages: [smsMessage],
    };
    try {
      return await this.client.smsSendPost(smsMessageCollection);
    } catch (error) {
      ConduitGrpcSdk.Logger.error(error as Error);
      return Promise.reject(Error('could not send message'));
    }
  }

  async sendVerificationCode(phoneNumber: string) {
    const otp: string = generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });
    const smsMessage: SmsMessage = {
      body: `Your verification code is ${otp}`,
      to: phoneNumber,
    };
    const smsMessageCollection: SmsMessageCollection = {
      messages: [smsMessage],
    };
    try {
      await this.client.smsSendPost(smsMessageCollection);
      await this.grpcSdk.state!.setKey(phoneNumber, otp, 120000);
      return Promise.resolve(phoneNumber);
    } catch (error) {
      ConduitGrpcSdk.Logger.error(error as Error);
      return Promise.reject(Error('could not send verification code'));
    }
  }

  async verify(phoneNumber: string, otp: string): Promise<boolean> {
    const otpCode: string | null = await this.grpcSdk.state!.getKey(phoneNumber);
    if (otpCode === null) {
      return Promise.reject(false);
    }
    if (otpCode === otp) {
      return Promise.resolve(true);
    }
    return Promise.reject(false);
  }
}
