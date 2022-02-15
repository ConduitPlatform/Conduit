import ConduitGrpcSdk, {
  ConduitError,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
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
  initialized: boolean = false;
  protected mapScopes: any;

  constructor(grpcSdk: ConduitGrpcSdk, providerName: string, settings: S) {
    this.providerName = providerName;
    this.grpcSdk = grpcSdk;
    this.settings = settings;
  }

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig[this.providerName].enabled) {
      console.log(`${this.providerName} not active`);
      throw ConduitError.forbidden(`${this.providerName} auth is deactivated`);
    }
    if (
      !authConfig[this.providerName] ||
      !authConfig[this.providerName].clientId ||
      !authConfig[this.providerName].clientSecret
    ) {
      console.log(`${this.providerName} is not active`);
      throw ConduitError.forbidden(
        `Cannot enable ${this.providerName} auth due to missing clientId or client secret`,
      );
    }
    console.log(`${this.providerName} is active`);
    this.initialized = true;
    return true;
  }

  async redirect(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let scopes = call.request.params?.scopes;
    let options: any = {
      client_id: this.settings.clientId,
      redirect_uri: this.settings.callbackUrl,
      response_type: this.settings.responseType,
      scope: scopes,
    };
    let baseUrl = this.settings.authorizeUrl;
    options['state'] = call.request.context.clientId + ',' + scopes;

    let url = Object.keys(options).map((k: any) => {
      return k + '=' + options[k];
    }).join('&');
    return baseUrl + url;
  };

  async authorize(call: ParsedRouterRequest) {
    const params = call.request.params;
    const myParams: any = {
      client_id: this.settings.clientId,
      client_secret: this.settings.clientSecret,
      code: params.code,
      redirect_uri: 'http://localhost:3000/hook/authentication/' + this.settings.providerName,
    };

    if ((this.settings).hasOwnProperty('grantType')) {
      myParams['grant_type'] = this.settings.grantType;
    }

    let providerOptions = await this.makeRequest(myParams);
    const providerResponse: any = await axios(providerOptions).catch((e: any) => console.log(e));
    let access_token = providerResponse.data.access_token;
    let state = params.state;
    state = {
      clientId: state[0],
      scopes: await this.constructScopes(state.slice(1, state.length)),
    };

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
        (tokens.refreshToken as any),
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

  abstract declareRoutes(): void;

  abstract makeRequest(data: any): Promise<AxiosRequestConfig>;

  abstract connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<T>;

  abstract constructScopes(scopes: string[]): Promise<string>;
}
