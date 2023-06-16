import { ISmsProvider } from '../interfaces/ISmsProvider';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { generate } from 'otp-generator';

export class AwsProvider implements ISmsProvider {
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
      return Promise.resolve(result.MessageId);
    } catch (error) {
      ConduitGrpcSdk.Logger.error(error as Error);
      return Promise.reject(Error('could not send message'));
    }
  }

  async sendVerificationCode(phoneNumber: string) {
    const otp = generate(6, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });
    const params = {
      Message: `Your verification code is: ${otp}`,
      PhoneNumber: phoneNumber,
    };
    const command = new PublishCommand(params);
    try {
      await this.client.send(command);
    } catch (error) {
      ConduitGrpcSdk.Logger.error(error as Error);
      return Promise.reject(Error('could not send verification code'));
    }
    await this.grpcSdk.state!.setKey(phoneNumber, otp, 60000);
    return Promise.resolve(phoneNumber);
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
