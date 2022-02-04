import ConduitGrpcSdk, {
  GrpcError, ParsedRouterRequest, UnparsedRouterResponse,
} from '@conduitplatform/conduit-grpc-sdk';
import { Payload } from '../interfaces/Payload';
import {forEach, isNil} from 'lodash';
import { status } from '@grpc/grpc-js';
import { User } from '../../models';
import { AuthUtils } from '../../utils/auth';
import { ConfigController } from '../../config/Config.controller';
import { RedirectOptions } from "../interfaces/RedirectOptions";

export abstract class AuthenticationProviderClass<T extends Payload> {
  private providerName: string;
  grpcSdk: ConduitGrpcSdk;
  private redirectOptions: RedirectOptions;

  constructor(grpcSdk: ConduitGrpcSdk, providerName: string) {
    this.providerName = providerName;
    this.grpcSdk = grpcSdk;
    this.redirectOptions = {};
  }

  abstract async validate(): Promise<Boolean>;
  abstract async connectWithProvider(call: ParsedRouterRequest): Promise<any>;

  async setRedirectOptions(options: RedirectOptions) {
    for (const element in options) {
      this.redirectOptions[element] = options[element];
    }
  }

  async beginAuth(call: ParsedRouterRequest) {
    const config = ConfigController.getInstance().config;
    const serverConfig = await this.grpcSdk.config.getServerConfig();
    const redirect = serverConfig.url + this.redirectOptions.hookPath;
    const clientId = call.request.context.clientId;
    let retUrl = this.redirectOptions.url;
    return retUrl + `?client_id=${config[this.providerName].clientId}&redirect_uri=${redirect}&response_type=code&scope=user:read:email&state=${clientId}`;
  }

  async authenticate(call: ParsedRouterRequest,redirect: boolean): Promise<UnparsedRouterResponse> {
    let payload = await this.connectWithProvider(call);
    const config = ConfigController.getInstance().config;
    let user: User | null | any = null;
    if (payload.hasOwnProperty('email')) {
      user = await User.getInstance().findOne({
        email: payload.email,
      });
    }
    else if (payload.hasOwnProperty('id') && !payload.hasOwnProperty('email')) {
      user = await User.getInstance().findOne({
        [this.providerName]: { id: payload.id },
      });
    }
    if (!isNil(user)) {
      if (!user.active) throw new GrpcError(status.PERMISSION_DENIED, 'Inactive user');
      if (!config[this.providerName].accountLinking) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'User with this email already exists',
        );
      }

      if (isNil(user[this.providerName])) {
        user[this.providerName] = payload;
        // TODO look into this again, as the email the user has registered will still not be verified
        if (!user.isVerified) user.isVerified = true;
        user = await User.getInstance().findByIdAndUpdate(user._id, user);
      }
    } else {
      user = await User.getInstance().create({
        email: payload.email,
        [this.providerName]:  payload,
        isVerified: true,
      });
    }
    const [accessToken, refreshToken] = await AuthUtils.createUserTokensAsPromise(
      this.grpcSdk,
      {
        userId: user!._id,
        clientId: payload.clientId,
        config: config,
      },
    );

    let retObject: any = {
      userId: user!._id.toString(),
      accessToken: (accessToken as any).token,
      refreshToken: (refreshToken as any).token,
    };
    if(redirect) {
      retObject['redirect'] = config[this.providerName].redirect_uri +
          '?accessToken=' +
          (accessToken as any).token +
          '&refreshToken=' +
          (refreshToken as any).token
    }
    return retObject;
  }
}