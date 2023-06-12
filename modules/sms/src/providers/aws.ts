import { ISmsProvider } from '../interfaces/ISmsProvider';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import AWS, { SNS } from 'aws-sdk';
import { generate } from 'otp-generator';
export class AwsProvider implements ISmsProvider {
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly region: string;
  private grpcSdk: ConduitGrpcSdk;
  private client: SNS;
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
    AWS.config.update({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
    this.client = new AWS.SNS();
  }

  async sendSms(phoneNumber: string, message: string) {
    const result = await this.client
      .publish({
        PhoneNumber: phoneNumber,
        Message: message,
      })
      .promise()
      .catch(error => {
        ConduitGrpcSdk.Logger.error(error);
      });
    if (!result) {
      return Promise.reject(Error('could not send message'));
    }
    return Promise.resolve(result.MessageId);
  }

  async sendVerificationCode(phoneNumber: string) {
    const otp = generate(4, {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false,
    });
    const result = await this.client
      .publish({
        PhoneNumber: phoneNumber,
        Message: `Your verification code is: ${otp}`,
      })
      .promise()
      .catch(error => {
        ConduitGrpcSdk.Logger.error(error);
      });
    if (!result) {
      return Promise.reject(Error('could not send verification code'));
    }
    await this.grpcSdk.state!.setKey(phoneNumber, otp, 60.0);
    return Promise.resolve(phoneNumber);
  }

  async verify(phoneNumber: string, otp: string): Promise<boolean> {
    const otpCode: string | null = await this.grpcSdk.state!.getKey(phoneNumber);
    if (otpCode == null) {
      return Promise.reject(false);
    }
    if (otpCode === otp) {
      return Promise.resolve(true);
    }
    return Promise.reject(false);
  }
}
