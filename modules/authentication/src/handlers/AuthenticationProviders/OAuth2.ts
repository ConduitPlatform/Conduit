import ConduitGrpcSdk, {
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/conduit-grpc-sdk';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { User } from '../../models';
import { AuthUtils } from '../../utils/auth';
import axios, { AxiosRequestConfig } from 'axios';
import { Payload } from './interfaces/Payload';
import { OAuth2Settings } from './interfaces/OAuth2Settings';
import { ConfigController } from '../../config/Config.controller';

export abstract class OAuth2<T extends Payload, S extends OAuth2Settings> {
  grpcSdk: ConduitGrpcSdk;
  private providerName: string;
  protected settings: S;

  constructor(grpcSdk: ConduitGrpcSdk, providerName: string, settings: S) {
    this.providerName = providerName;
    this.grpcSdk = grpcSdk;
    this.settings = settings;
  }

  async redirect(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let options: any = {
      client_id: this.settings.clientId,
      redirect_uri: this.settings.callbackUrl,
      response_type: this.settings.response_type,
      scope: call.request.params?.scopes,
    };

    let retUrl = this.settings.authorizeUrl;
    let length = Object.keys(options).length;
    // options['state'] = JSON.stringify({ clientId: call.request.context.clientId, scope: options.scope });

    options['state'] = call.request.context.clientId + "::" + options.scope;
    Object.keys(options).forEach((k, i) => {
      if (k !== 'url' && !isNil(options[k])) {
        retUrl += k + '=' + options[k];
        if (i !== length) retUrl += '&';
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
      // add server config url here
      redirect_uri: 'http://localhost:3000/hook/authentication/' + this.settings.providerName,
    };

    if ((this.settings).hasOwnProperty('grant_type')) {
      myparams['grant_type'] = this.settings.grant_type;
    }

    const providerOptions: AxiosRequestConfig = {
      method: this.settings.accessTokenMethod as any,
      url: this.settings.tokenUrl,
      params: { ...myparams },
      data: null,
    };
    const providerResponse: any = await axios(providerOptions).catch((e:any) => console.log(e));
    let access_token = providerResponse.data.access_token ?? providerResponse.data;
    let state = params.state.split('::');
    state = {
      clientId: state[0],
      scopes: state[1]
    }
    let clientId = state.clientId;
    let payload = await this.connectWithProvider({ accessToken: access_token, clientId, scope: state.scopes });
    let user = await this.createOrUpdateUser(payload);
    const config = ConfigController.getInstance().config;
    let tokens = await this.createTokens(user._id, clientId, config);
    return {
      redirect: this.settings.finalRedirect +
        '?accessToken=' +
        (tokens.accessToken as any) +
        '&refreshToken=' +
        (tokens.refreshToken as any)
    };
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {

    let payload = await this.connectWithProvider({
      accessToken: call.request.params['access_token'],
      clientId: call.request.params['clientId'],
      scope: call.request.params?.scope,
    });
    let user = await this.createOrUpdateUser(payload);
    const config = ConfigController.getInstance().config;
    let tokens = await this.createTokens(user._id, call.request.params['clientId'], config);
    return {
      userId: user!._id.toString(),
      accessToken: (tokens.accessToken as any),
      refreshToken: (tokens.refreshToken as any),
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
      if (!this.settings.accountLinking) {
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
        config,
      },
    );
    return {
      userId: userId.toString(),
      accessToken: (accessToken as any).token,
      refreshToken: (refreshToken as any).token,
    };

  }

  abstract async validate(): Promise<Boolean>;

  abstract async connectWithProvider(details: { accessToken: string, clientId: string, scope: string}): Promise<T>;

}
