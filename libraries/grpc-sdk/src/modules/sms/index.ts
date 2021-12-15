import { ConduitModule } from '../../classes/ConduitModule';
import {
  SendSmsResponse,
  SendVerificationCodeResponse,
  SetConfigResponse,
  SmsClient,
  VerifyResponse,
} from '../../protoUtils/sms';
import { ServiceError } from '@grpc/grpc-js';

export class SMS extends ConduitModule<SmsClient> {
  constructor(moduleName: string, url: string) {
    super(moduleName, url);
    this.initializeClient(SmsClient);
  }

  setConfig(newConfig: any): Promise<SetConfigResponse> {
    return new Promise((resolve, reject) => {
      this.client?.setConfig(
        { newConfig: JSON.stringify(newConfig) },
        (err: ServiceError | null, res) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.updatedConfig));
          }
        }
      );
    });
  }

  sendSms(to: string, message: string): Promise<SendSmsResponse> {
    return new Promise((resolve, reject) => {
      this.client?.sendSms({ to, message }, (err: ServiceError | null, res) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res);
        }
      });
    });
  }

  sendVerificationCode(to: string): Promise<SendVerificationCodeResponse> {
    return new Promise((resolve, reject) => {
      this.client?.sendVerificationCode({ to }, (err: ServiceError | null, res) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res);
        }
      });
    });
  }

  verify(verificationSid: string, code: string): Promise<VerifyResponse> {
    return new Promise((resolve, reject) => {
      this.client?.verify({ verificationSid, code }, (err: ServiceError | null, res) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res);
        }
      });
    });
  }
}
