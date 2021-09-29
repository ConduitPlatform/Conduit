import { ConduitModule } from '../../classes/ConduitModule';
import {
  AuthenticationClient,
  SetConfigResponse,
  UserCreateResponse,
  UserDeleteResponse,
  UserLoginResponse,
} from '../../protoUtils/authentication';
import { ServiceError } from '@grpc/grpc-js';

export class Authentication extends ConduitModule<AuthenticationClient> {
  constructor(url: string) {
    super(url);
    this.initializeClient(AuthenticationClient);
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

  userLogin(userId: string, clientId: string): Promise<UserLoginResponse> {
    return new Promise((resolve, reject) => {
      this.client?.userLogin({ userId, clientId }, (err: ServiceError | null, res) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res);
        }
      });
    });
  }

  userDelete(userId: string): Promise<UserDeleteResponse> {
    return new Promise((resolve, reject) => {
      this.client?.userDelete({ userId }, (err: ServiceError | null, res) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res);
        }
      });
    });
  }

  userCreate(
    email: string,
    verify: boolean = false,
    password?: string
  ): Promise<UserCreateResponse> {
    return new Promise((resolve, reject) => {
      this.client?.userCreate(
        { email, verify, password },
        (err: ServiceError | null, res) => {
          if (err || !res) {
            reject(err || 'Something went wrong');
          } else {
            resolve(res);
          }
        }
      );
    });
  }

  changePass(email: string, password?: string): Promise<UserCreateResponse> {
    return new Promise((resolve, reject) => {
      this.client?.changePass({ email, password }, (err: ServiceError | null, res) => {
        if (err || !res) {
          reject(err || 'Something went wrong');
        } else {
          resolve(res);
        }
      });
    });
  }
}
