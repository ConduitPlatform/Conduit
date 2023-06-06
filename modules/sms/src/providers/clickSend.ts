import { ISmsProvider } from '../interfaces/ISmsProvider';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { SMSApi, SmsMessage, SmsMessageCollection } from 'clicksend';

function generateOTP(): string {
  return Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');
}
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
      return Promise.reject(Error('could not send message'));
    }
  }

  async sendVerificationCode(phoneNumber: string) {
    const otp = generateOTP();
    const smsMessage: SmsMessage = {
      body: `Your verification code is ${otp}`,
      to: phoneNumber,
    };
    const smsMessageCollection: SmsMessageCollection = {
      messages: [smsMessage],
    };
    try {
      await this.client.smsSendPost(smsMessageCollection);
      await this.grpcSdk.state!.setKey(phoneNumber, otp, 60.0);
      return Promise.resolve(phoneNumber);
    } catch (error) {
      return Promise.reject(Error('could not send verification code'));
    }
  }

  async verify(phoneNumber: string, otp: string): Promise<boolean> {
    const otpCode: string | null = await this.grpcSdk.state!.getKey(phoneNumber);
    if (otpCode == null) {
      return Promise.reject(false);
    }
    if (otpCode == otp) {
      return Promise.resolve(true);
    }
    return Promise.reject(false);
  }
}
