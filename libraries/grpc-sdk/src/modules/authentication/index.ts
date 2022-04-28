import { ConduitModule } from '../../classes/ConduitModule';
import {
  AuthenticationDefinition,
  SetConfigResponse,
  UserCreateResponse,
  UserDeleteResponse,
  UserLoginResponse,
} from '../../protoUtils/authentication';

export class Authentication extends ConduitModule<typeof AuthenticationDefinition> {
  constructor(moduleName: string, url: string) {
    super(moduleName, 'authentication', url);
    this.initializeClient(AuthenticationDefinition);
  }

  setConfig(newConfig: any): Promise<SetConfigResponse> {
    return this.client!.setConfig(
      { newConfig: JSON.stringify(newConfig) })
      .then(res => {
        return JSON.parse(res.updatedConfig);
      });
  }

  userLogin(userId: string, clientId: string): Promise<UserLoginResponse> {
    return this.client!.userLogin({ userId, clientId });
  }

  userDelete(userId: string): Promise<UserDeleteResponse> {
    return this.client!.userDelete({ userId });
  }

  userCreate(
    email: string,
    verify: boolean = false,
    password?: string,
  ): Promise<UserCreateResponse> {
    return this.client!.userCreate({ email, verify, password });
  }

  changePass(email: string, password?: string): Promise<UserCreateResponse> {
    return this.client!.changePass({ email, password });
  }
}
