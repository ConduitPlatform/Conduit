import { ISmsProvider } from '../interfaces/ISmsProvider';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import AWS, { SNS, AWSError } from 'aws-sdk';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
export class AwsProvider implements ISmsProvider {
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly region: string;
  private client: SNS;

  constructor(settings: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  }) {
    ({
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
    } = settings);

    this.client = new AWS.SNS({
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
    });
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
    await this.client
      .createSMSSandboxPhoneNumber({ PhoneNumber: phoneNumber })
      .promise()
      .catch((error: AWSError) => {
        ConduitGrpcSdk.Logger.error(error);
      });

    const otp = generateOTP();

    const result = await this.client
      .publish({
        PhoneNumber: phoneNumber,
        Message: `Your OTP is: ${otp}`,
      })
      .promise()
      .catch(error => {
        ConduitGrpcSdk.Logger.error(error);
      });

    if (!result) {
      return Promise.reject(Error('could not send verification code'));
    }
    return phoneNumber;
  }

  async verify(phoneNumber: string, otp: string): Promise<boolean> {
    const params = {
      PhoneNumber: phoneNumber,
      OneTimePassword: otp,
    };
    this.client.verifySMSSandboxPhoneNumber(params, function (error, data) {
      if (error) {
        ConduitGrpcSdk.Logger.error(error);
      } else {
        return Promise.resolve('OTP verification successful!');
      }
    });
    return Promise.reject(Error('OTP verification failed!'));
  }
}
