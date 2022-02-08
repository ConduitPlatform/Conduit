import ConduitGrpcSdk, {
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/conduit-grpc-sdk';
import { Payload } from '../interfaces/Payload';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { User } from '../../models';
import { AuthUtils } from '../../utils/auth';
import axios, { AxiosRequestConfig } from 'axios';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';

export abstract class OAuth2<T extends Payload> {
  grpcSdk: ConduitGrpcSdk;
  private providerName: string;
  private settings: OAuth2Settings;
  private config: any;

  constructor(grpcSdk: ConduitGrpcSdk, providerName: string) {
    this.providerName = providerName;
    this.grpcSdk = grpcSdk;
  }

  setConfigs(authConfig: any, settings: OAuth2Settings) {
    this.config = authConfig;
    this.settings = settings;
  }

  async redirect(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let options: any = {
      client_id: this.settings.clientId,
      redirect_uri: this.settings.callbackUrl,
      state: this.settings.state,
      response_type: this.settings.response_type,
      scope: this.settings.scope,
    };

    let retUrl = this.settings.authorizeUrl;
    let length = Object.keys(options).length;
    //if (options.hasOwnProperty('state')) options['state'] = call.request.context.clientId;
    Object.keys(options).forEach((k, i) => {
      if (k !== 'url') {
        retUrl += k + '=' + options[k];
        if (i !== length - 1) retUrl += '&';
      }
    });
    return retUrl;
  };

  async authorize(call: ParsedRouterRequest) {
    const params = call.request.params;
    const myparams: any = {
      client_id: this.settings.clientId,
      client_secret: this.settings.clientSecret,
      code: params.code,
      redirect_uri: '/hook/authentication/' + this.settings.providerName,
    };

    if ((this.settings).hasOwnProperty('grant_type')) {
      myparams['grant_type'] = this.settings.grant_type;
    }
    const providerOptions: AxiosRequestConfig = {
      method: this.settings.accessTokenMethod as any,
      url: this.settings.tokenUrl,
      params: { myparams },
    };
    const providerResponse: any = await axios(providerOptions);
    let access_token = providerResponse.data.access_token;
    let clientId = params.state;

    let payload = this.connectWithProvider({ accessToken: access_token, clientId });
    let user = await this.createOrUpdateUser(payload);
    let tokens = await this.createTokens(user._id, clientId, {});
    return {
      redirect: this.config[this.providerName].redirect_uri +
        '?accessToken=' +
        (tokens.accessToken as any).token +
        '&refreshToken=' +
        (tokens.refreshToken as any).token,
    };
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {

    let payload = this.connectWithProvider({
      accessToken: call.request.params['access_token'],
      clientId: call.request.params['clientId'],
    });
    let user = await this.createOrUpdateUser(payload);
    let tokens = await this.createTokens(user._id, call.request.params['clientId'], {});
    return {
      userId: user!._id.toString(),
      accessToken: (tokens.accessToken as any).token,
      refreshToken: (tokens.refreshToken as any).token,
    };
  }

  async createOrUpdateUser(payload: any): Promise<User> {
    let user: User | null | any = null;
    if (payload.hasOwnProperty('email')) {
      user = await User.getInstance().findOne({
        email: payload.email,
      });
    } else if (payload.hasOwnProperty('id') && !payload.hasOwnProperty('email')) {
      user = await User.getInstance().findOne({
        [this.providerName]: { id: payload.id },
      });
    }
    if (!isNil(user)) {
      if (!user.active) throw new GrpcError(status.PERMISSION_DENIED, 'Inactive user');
      if (!this.config[this.providerName].accountLinking) {
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
        [this.providerName]: payload,
        isVerified: true,
      });
    }
    return user;
  }

  async createTokens(userId: string, clientId: string, config: any) {
    const [accessToken, refreshToken] = await AuthUtils.createUserTokensAsPromise(
      this.grpcSdk,
      {
        userId: userId,
        clientId: clientId,
        config: config,
      },
    );
    return {
      userId: userId.toString(),
      accessToken: (accessToken as any).token,
      refreshToken: (refreshToken as any).token,
    };

  }

  abstract async validate(): Promise<Boolean>;

  abstract async connectWithProvider(details: { accessToken: string, clientId: string }): Promise<any>;

  //
  // async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
  //   let payload: any;
  //   let credentials: any;
  //   const config = ConfigController.getInstance().config;
  //   if (call.request.path.startsWith('/hook')) {
  //
  //     credentials = await this.createTokens(call);
  //     call.request.params['access_token'] = credentials.access_token;
  //     call.request.context['clientId'] = credentials.clientId;
  //   }
  //
  //   payload = await this.connectWithProvider(call);
  //
  //
  //   const [accessToken, refreshToken] = await AuthUtils.createUserTokensAsPromise(
  //     this.grpcSdk,
  //     {
  //       userId: user!._id,
  //       clientId: payload.clientId,
  //       config: config,
  //     },
  //   );
  //
  //   let retObject: any = {
  //     userId: user!._id.toString(),
  //     accessToken: (accessToken as any).token,
  //     refreshToken: (refreshToken as any).token,
  //   };
  //   if (call.request.path.startsWith('/hook')) {
  //     retObject['redirect'] = config[this.providerName].redirect_uri +
  //       '?accessToken=' +
  //       (accessToken as any).token +
  //       '&refreshToken=' +
  //       (refreshToken as any).token;
  //   }
  //   return retObject;
  // }
}
