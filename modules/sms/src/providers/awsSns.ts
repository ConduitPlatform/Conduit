import { ISmsProvider } from '../interfaces/ISmsProvider.js';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { generateToken } from '../utils/index.js';
import * as bcrypt from 'bcrypt';

export class AwsSnsProvider implements ISmsProvider {
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly region: string;
  private grpcSdk: ConduitGrpcSdk;
  private client: SNSClient;
  constructor(
    settings: {
      accessKeyId: string;
      secretAccessKey: string;
      region: string;
    },
    grpcSdk: ConduitGrpcSdk,
  ) {
    ({
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
    } = settings);
    this.grpcSdk = grpcSdk;
    this.client = new SNSClient({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }

  async sendSms(phoneNumber: string, message: string) {
    const params = {
      Message: message,
      PhoneNumber: phoneNumber,
    };
    const command = new PublishCommand(params);
    try {
      const result = await this.client.send(command);
      return result.MessageId;
    } catch (error) {
      ConduitGrpcSdk.Logger.error(error as Error);
      return 'could not send message';
    }
  }

  async sendVerificationCode(phoneNumber: string) {
    const otp: string = generateToken();
    const params = {
      Message: `Your verification code is: ${otp}`,
      PhoneNumber: phoneNumber,
    };
    const command = new PublishCommand(params);
    try {
      await this.client.send(command);
    } catch (error) {
      ConduitGrpcSdk.Logger.error(error as Error);
      return 'could not send verification code';
    }
    const phoneNumberHash = await bcrypt.hash(phoneNumber, 11);
    await this.grpcSdk.state!.setKey(phoneNumberHash, otp, 60000);
    return phoneNumberHash;
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
