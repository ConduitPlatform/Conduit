import ConduitGrpcSdk, {
  ConduitError,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  ConfigController,
  RoutingManager,
  ConduitRouteActions,
  ConduitString,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { User } from '../../models';
import { AuthUtils } from '../../utils/auth';
import axios from 'axios';
import { Payload } from './interfaces/Payload';
import { OAuth2Settings } from './interfaces/OAuth2Settings';
import { Cookie } from '../../interfaces/Cookie';
import { RedirectOptions } from './interfaces/RedirectOptions';
import { AuthParams } from './interfaces/AuthParams';
import { IAuthenticationStrategy } from '../../interfaces/AuthenticationStrategy';
import { ConnectionParams } from './interfaces/ConnectionParams';
import { Config } from '../../config';
import { OAuthRequest } from './interfaces/MakeRequest';
import { TokenProvider } from '../tokenProvider';

export abstract class OAuth2<T, S extends OAuth2Settings>
  implements IAuthenticationStrategy
{
  grpcSdk: ConduitGrpcSdk;
  private providerName: string;
  protected settings: S;
  initialized: boolean = false;
  mapScopes: { [key: string]: string };
  defaultScopes: string[];

  constructor(grpcSdk: ConduitGrpcSdk, providerName: string, settings: S) {
    this.providerName = providerName;
    this.grpcSdk = grpcSdk;
    this.settings = settings;
    this.settings.provider = providerName;
  }

  async validate(): Promise<boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig[this.providerName].enabled) {
      ConduitGrpcSdk.Logger.log(`${this.providerName} not active`);
      return (this.initialized = false);
    }
    if (
      !authConfig[this.providerName] ||
      !authConfig[this.providerName].clientId ||
      !authConfig[this.providerName].clientSecret
    ) {
      ConduitGrpcSdk.Logger.log(`${this.providerName} is not active`);
      return (this.initialized = false);
    }
    ConduitGrpcSdk.Logger.log(`${this.providerName} is active`);

    return (this.initialized = true);
  }

  async redirect(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const scopes = call.request.params?.scopes ?? this.defaultScopes;
    const options: RedirectOptions = {
      client_id: this.settings.clientId,
      redirect_uri: this.settings.callbackUrl,
      response_type: this.settings.responseType,
      scope: this.constructScopes(scopes),
    };
    const baseUrl = this.settings.authorizeUrl;
    options['state'] = call.request.context.clientId + ',' + options.scope;

    const keys = Object.keys(options) as [keyof RedirectOptions];
    const url = keys
      .map(k => {
        return k + '=' + options[k];
      })
      .join('&');
    return baseUrl + url;
  }

  async authorize(call: ParsedRouterRequest) {
    const params = call.request.params;
    const conduitUrl = (await this.grpcSdk.config.get('router')).hostUrl;
    const myParams: AuthParams = {
      client_id: this.settings.clientId,
      client_secret: this.settings.clientSecret,
      code: params.code,
      redirect_uri: `${conduitUrl}/hook/authentication/${this.settings.providerName}`,
    };

    if (this.settings.hasOwnProperty('grantType')) {
      myParams['grant_type'] = this.settings.grantType;
    }

    const providerOptions = this.makeRequest(myParams);
    const providerResponse: { data: { access_token: string } } = await axios(
      providerOptions,
    );
    const access_token = providerResponse.data.access_token;
    let state = params.state;
    state = {
      clientId: state[0],
      scopes: this.constructScopes(state.slice(1, state.length)),
    };

    const clientId = state.clientId;
    const payload = await this.connectWithProvider({
      accessToken: access_token,
      clientId,
      scope: state.scopes,
    });
    const user = await this.createOrUpdateUser(payload);
    const config = ConfigController.getInstance().config;
    ConduitGrpcSdk.Metrics?.increment('logged_in_users_total');

    return await TokenProvider.getInstance()!.provideUserTokens(
      {
        user,
        clientId,
        config,
      },
      this.settings.finalRedirect,
    );
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    ConduitGrpcSdk.Metrics?.increment('login_requests_total');
    const payload = await this.connectWithProvider({
      accessToken: call.request.params['access_token'],
      clientId: call.request.params['clientId'],
      scope: call.request.params?.scope,
    });
    const user = await this.createOrUpdateUser(payload);
    const config = ConfigController.getInstance().config;
    ConduitGrpcSdk.Metrics?.increment('logged_in_users_total');

    return TokenProvider.getInstance()!.provideUserTokens({
      user,
      clientId: call.request.params['clientId'],
      config,
    });
  }

  async createOrUpdateUser(payload: Payload<T>): Promise<User> {
    let user: User | null = null;
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
      if (!user!.active) throw new GrpcError(status.PERMISSION_DENIED, 'Inactive user');
      if (!this.settings.accountLinking) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'User with this email already exists',
        );
      }

      // @ts-ignore
      user[this.providerName] = payload;
      // TODO look into this again, as the email the user has registered will still not be verified
      if (!user.isVerified) user.isVerified = true;
      user = await User.getInstance().findByIdAndUpdate(user._id, user);
    } else {
      user = await User.getInstance().create({
        email: payload.email,
        [this.providerName]: payload,
        isVerified: true,
      });
    }
    return user!;
  }

  declareRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: `/init/${this.providerName}`,
        description: `Begins ${this.capitalizeProvider()} authentication.`,
        action: ConduitRouteActions.GET,
        queryParams: {
          scopes: [ConduitString.Optional],
        },
      },
      new ConduitRouteReturnDefinition(
        `${this.capitalizeProvider()}InitResponse`,
        'String',
      ),
      this.redirect.bind(this),
    );

    routingManager.route(
      {
        path: `/hook/${this.providerName}`,
        action: ConduitRouteActions.GET,
        description: `Login/register with ${this.capitalizeProvider()} using redirect.`,
        queryParams: {
          code: ConduitString.Required,
          state: [ConduitString.Required],
        },
      },
      new ConduitRouteReturnDefinition(`${this.capitalizeProvider()}Response`, {
        userId: ConduitString.Required,
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.authorize.bind(this),
    );
  }

  makeRequest(data: AuthParams): OAuthRequest {
    return {
      method: this.settings.accessTokenMethod,
      url: this.settings.tokenUrl,
      params: { ...data },
      headers: {
        Accept: 'application/json',
      },
    };
  }

  abstract connectWithProvider(details: ConnectionParams): Promise<Payload<T>>;

  constructScopes(scopes: string[]): string {
    return scopes.join(',');
  }

  private capitalizeProvider = () => {
    return this.providerName.charAt(0).toUpperCase() + this.providerName.substr(1);
  };
}
