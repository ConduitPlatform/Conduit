import path from 'path';
import { ConduitModule } from '../../classes/ConduitModule';

export default class SMS extends ConduitModule {
  constructor(url: string) {
    super(url);
    this.protoPath = path.resolve(__dirname, '../../proto/sms.proto');
    this.descriptorObj = 'sms.Sms';
    this.initializeClient();
  }

  setConfig(newConfig: any) {
    return new Promise((resolve, reject) => {
      this.client.setConfig(
        { newConfig: JSON.stringify(newConfig) },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(JSON.parse(res.updatedConfig));
          }
        }
      );
    });
  }

  sendSms(to: string, message: string) {
    return new Promise((resolve, reject) => {
      this.client.sendSms(
        { to, message },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(res.message);
          }
        }
      );
    });
  }

  sendVerificationCode(to: string) {
    return new Promise((resolve, reject) => {
      this.client.sendVerificationCode({ to }, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res.verificationSid);
        }
      });
    });
  }

  verify(verificationSid: string, code: string) {
    return new Promise((resolve, reject) => {
      this.client.verify(
        { verificationSid, code },
        (err: any, res: any) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(res.verified);
          }
        }
      );
    });
  }
}
