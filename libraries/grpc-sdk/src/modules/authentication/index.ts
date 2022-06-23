import { ConduitModule } from '../../classes/ConduitModule';
import {
  AuthenticationDefinition,
  UserCreateResponse,
  UserDeleteResponse,
  UserLoginResponse,
} from '../../protoUtils/authentication';

export class Authentication extends ConduitModule<typeof AuthenticationDefinition> {
  constructor(private readonly moduleName: string, url: string, grpcToken?: string) {
    super(moduleName, 'authentication', url, grpcToken);
    this.initializeClient(AuthenticationDefinition);
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
