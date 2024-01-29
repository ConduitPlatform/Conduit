import { ISmsProvider } from '../interfaces/ISmsProvider.js';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { SMSApi, SmsMessage, SmsMessageCollection } from 'clicksend';
import { generateToken } from '../utils/index.js';
import * as bcrypt from 'bcrypt';
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
      return 'could not send message';
    }
  }

  async sendVerificationCode(phoneNumber: string) {
    const otp: string = generateToken();
    const smsMessage: SmsMessage = {
      body: `Your verification code is ${otp}`,
      to: phoneNumber,
    };
    const smsMessageCollection: SmsMessageCollection = {
      messages: [smsMessage],
    };
    try {
      await this.client.smsSendPost(smsMessageCollection);
      const phoneNumberHash = await bcrypt.hash(phoneNumber, 11);
      await this.grpcSdk.state!.setKey(phoneNumberHash, otp, 60000);
      return phoneNumberHash;
    } catch (error) {
      ConduitGrpcSdk.Logger.error(error as Error);
      return 'could not send verification code';
    }
  }

  async verify(phoneNumberHash: string, otp: string): Promise<boolean> {
    const otpCode: string | null = await this.grpcSdk.state!.getKey(phoneNumberHash);
    if (otpCode === null) {
      return Promise.reject(false);
    }
    if (otpCode === otp) {
      return Promise.resolve(true);
    }
    return Promise.reject(false);
  }
}
