import { ISmsProvider } from '../interfaces/ISmsProvider';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import messagebird from 'messagebird';

export class messageBirdProvider implements ISmsProvider {
  private readonly accessKeyId: string;
  private client: messagebird.MessageBird;
  private originatorName: string;
  constructor(settings: { accessKeyId: string; originatorName: string }) {
    ({ accessKeyId: this.accessKeyId, originatorName: this.originatorName } = settings);
    this.client = require('messagebird').initClient(this.accessKeyId);
  }

  async sendSms(phoneNumber: string, message: string) {
    await this.client.messages.create(
      {
        originator: this.originatorName,
        recipients: [phoneNumber],
        body: message,
      },
      function (error: Error | null, response: messagebird.Message | null) {
        if (error) {
          ConduitGrpcSdk.Logger.error(error);
        } else {
          return response;
        }
      },
    );
  }

  async sendVerificationCode(phoneNumber: string) {
    return new Promise<string>((resolve, reject) => {
      const options = {
        originator: this.originatorName,
        template: 'Your verification code is %token.',
        timeout: 60,
      };
      this.client.verify.create(
        phoneNumber,
        options,
        (error: Error | null, response: any) => {
          if (error) {
            ConduitGrpcSdk.Logger.error(error);
            reject(new Error('Could not send verification code'));
          } else {
            resolve(response.id);
          }
        },
      );
    });
  }

  async verify(verificationId: string, otp: string): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      this.client.verify.verify(verificationId, otp, (error: Error | null) => {
        if (error) {
          ConduitGrpcSdk.Logger.error(error);
          reject(false);
        } else {
          resolve(true);
        }
      });
    });
  }
}
