import { ISmsProvider } from '../interfaces/ISmsProvider';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import messagebird, { initClient, MessageBird } from 'messagebird';

export class messageBirdProvider implements ISmsProvider {
  private readonly accessKeyId: string;
  private client: messagebird.MessageBird;
  constructor(settings: { accessKeyId: string }) {
    ({ accessKeyId: this.accessKeyId } = settings);
    this.client = initClient(this.accessKeyId);
  }

  async sendSms(phoneNumber: string, message: string) {
    await this.client.messages.create(
      {
        originator: 'Verification',
        recipients: [phoneNumber],
        body: message,
      },
      (error: Error | null) => {
        if (error) {
          ConduitGrpcSdk.Logger.error(error);
        }
      },
    );
  }

  async sendVerificationCode(phoneNumber: string) {
    await this.client.verify.create(
      phoneNumber,
      {
        originator: 'Verification',
        template: 'Your verification code is %token.',
      },
      (error: Error | null, response: any) => {
        if (error) {
          ConduitGrpcSdk.Logger.error(error);
          return Promise.reject(Error('could not send verification code'));
        } else {
          return Promise.resolve(response.id);
        }
      },
    );
    return Promise.reject(Error('could not send verification code'));
  }

  async verify(verificationId: string, otp: string): Promise<boolean> {
    await this.client.verify.verify(verificationId, otp, (error: Error | null) => {
      if (error) {
        ConduitGrpcSdk.Logger.error(error);
        return Promise.reject(false);
      } else {
        return Promise.resolve(true);
      }
    });
    return Promise.resolve(false);
  }
}
