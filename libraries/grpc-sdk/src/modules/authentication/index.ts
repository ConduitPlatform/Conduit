import { ConduitModule } from '../../classes/ConduitModule';
import { AuthenticationClient } from '../../protoUtils/authentication';

export class Authentication extends ConduitModule<AuthenticationClient> {
  constructor(url: string) {
    super(url);
    this.initializeClient(AuthenticationClient);
  }

  setConfig(newConfig: any) {
    return new Promise((resolve, reject) => {
      this.client?.setConfig(
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

  userLogin(userId: string, clientId: string) {
    return new Promise((resolve, reject) => {
      this.client?.userLogin({ userId, clientId }, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res);
        }
      });
    });
  }

  userDelete(userId: string) {
    return new Promise((resolve, reject) => {
      this.client?.userDelete({ userId }, (err: any, res: any) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res);
        }
      });
    });
  }
}
