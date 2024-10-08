import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { isNil, merge } from 'lodash-es';
import { status } from '@grpc/grpc-js';
import { Token, User } from '../../models/index.js';
import axios from 'axios';
import {
  AuthParams,
  ConnectionParams,
  OAuth2Settings,
  OAuthRequest,
  Payload,
  RedirectOptions,
} from './interfaces/index.js';
import { TokenProvider } from '../tokenProvider.js';

import { v4 as uuid } from 'uuid';
import { createHash } from 'crypto';
import { TeamsHandler } from '../team.js';
import { validateStateToken } from './utils/index.js';
import { IAuthenticationStrategy } from '../../interfaces/index.js';
import { TokenType } from '../../constants/index.js';
import {
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { AuthUtils } from '../../utils/index.js';

export abstract class OAuth2<T, S extends OAuth2Settings>
  implements IAuthenticationStrategy
{
  grpcSdk: ConduitGrpcSdk;
  initialized: boolean = false;
  mapScopes: { [key: string]: string };
  defaultScopes: string[];
  protected settings: S;
  private readonly providerName: string;

  protected constructor(grpcSdk: ConduitGrpcSdk, providerName: string, settings: S) {
    this.providerName = providerName;
    this.grpcSdk = grpcSdk;
    this.settings = settings;
    this.settings.provider = providerName;
  }

  async validate(): Promise<boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig[this.providerName].enabled) {
      ConduitGrpcSdk.Logger.log(`${this.providerName} authentication not available`);
      return (this.initialized = false);
    }
    if (
      !authConfig[this.providerName] ||
      !authConfig[this.providerName].clientId ||
      !authConfig[this.providerName].clientSecret
    ) {
      ConduitGrpcSdk.Logger.log(`${this.providerName} authentication not available`);
      return (this.initialized = false);
    }
    ConduitGrpcSdk.Logger.log(`${this.providerName} authentication is available`);
    return (this.initialized = true);
  }

  async initNative(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const scopes = call.request.params?.scopes ?? this.defaultScopes;
    const { anonymousUser } = call.request.context;
    const conduitUrl = (await this.grpcSdk.config.get('router')).hostUrl;

    // returns part of regular redirect options for native usage
    const queryOptions: Partial<RedirectOptions> = {
      client_id: this.settings.clientId,
      redirect_uri: conduitUrl + this.settings.callbackUrl,
      scope: this.constructScopes(scopes),
    };
    const stateToken = await Token.getInstance()
      .create({
        tokenType: TokenType.STATE_TOKEN,
        token: uuid(),
        data: {
          invitationToken: call.request.params?.invitationToken,
          clientId: call.request.context.clientId,
          scope: queryOptions.scope,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          customRedirectUri: call.request.params.redirectUri,
          anonymousUserId: anonymousUser?._id,
        },
      })
      .catch(err => {
        throw new GrpcError(status.INTERNAL, err);
      });
    queryOptions['state'] = stateToken.token;

    return queryOptions;
  }

  nativeAuthorize(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    throw new GrpcError(status.INTERNAL, 'Not supported for current provider');
  }

  async redirect(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const scopes = call.request.params?.scopes ?? this.defaultScopes;
    const { anonymousUser } = call.request.context;
    const conduitUrl = (await this.grpcSdk.config.get('router')).hostUrl;
    let codeChallenge;
    if (!isNil(this.settings.codeChallengeMethod)) {
      codeChallenge = createHash('sha256')
        .update(this.settings.codeVerifier!)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    }
    const queryOptions: RedirectOptions = {
      client_id: this.settings.clientId,
      redirect_uri: conduitUrl + this.settings.callbackUrl,
      response_type: this.settings.responseType,
      response_mode: this.settings.responseMode,
      scope: this.constructScopes(scopes),
      ...(codeChallenge !== undefined && { code_challenge: codeChallenge }),
      ...(this.settings.codeChallengeMethod !== undefined && {
        code_challenge_method: this.settings.codeChallengeMethod,
      }),
    };
    const baseUrl = this.settings.authorizeUrl.endsWith('?')
      ? this.settings.authorizeUrl.slice(0, -1)
      : this.settings.authorizeUrl;
    const stateToken = await Token.getInstance()
      .create({
        tokenType: TokenType.STATE_TOKEN,
        token: uuid(),
        data: {
          invitationToken: call.request.params?.invitationToken,
          clientId: call.request.context.clientId,
          scope: queryOptions.scope,
          codeChallenge: codeChallenge,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
          customRedirectUri: call.request.params.redirectUri,
          anonymousUserId: anonymousUser?._id,
        },
      })
      .catch(err => {
        throw new GrpcError(status.INTERNAL, err);
      });
    queryOptions['state'] = stateToken.token;

    const keys = Object.keys(queryOptions) as [keyof RedirectOptions];
    const queryString = keys
      .map(k => {
        return k + '=' + queryOptions[k];
      })
      .join('&');
    return baseUrl + '?' + queryString;
  }

  async authorize(call: ParsedRouterRequest) {
    const params = call.request.params;
    const stateToken = await validateStateToken(params.state);
    const conduitUrl = (await this.grpcSdk.config.get('router')).hostUrl;
    const config = ConfigController.getInstance().config;
    const myParams: AuthParams = {
      client_id: this.settings.clientId,
      client_secret: this.settings.clientSecret,
      code: params.code,
      redirect_uri: `${conduitUrl}/hook/authentication/${this.settings.providerName}`,
    };

    if (this.settings.hasOwnProperty('grantType')) {
      myParams['grant_type'] = this.settings.grantType;
    }
    if (!isNil(this.settings.codeChallengeMethod)) {
      myParams['code_verifier'] = this.settings.codeVerifier;
    }

    const providerOptions = this.makeRequest(myParams);
    const providerResponse: { data: { access_token: string } } = await axios(
      providerOptions,
    ).catch(err => {
      ConduitGrpcSdk.Logger.error(JSON.stringify(err.response.data));
      throw new GrpcError(status.INTERNAL, err.message);
    });
    const access_token = providerResponse.data.access_token;

    const clientId = stateToken.data.clientId;
    const scope = stateToken.data.scope;
    const payload = await this.connectWithProvider({
      accessToken: access_token,
      clientId,
      scope: scope,
    }).catch(err => {
      ConduitGrpcSdk.Logger.error(JSON.stringify(err.response.data));
      throw new GrpcError(status.INTERNAL, err.message);
    });

    await Token.getInstance().deleteOne(stateToken);
    const user = await this.createOrUpdateUser(
      payload,
      stateToken.data.invitationToken,
      stateToken.data.anonymousUserId,
    );
    ConduitGrpcSdk.Metrics?.increment('logged_in_users_total');

    const redirectUri =
      AuthUtils.validateRedirectUri(stateToken.data.customRedirectUri) ??
      this.settings.finalRedirect;
    return TokenProvider.getInstance().provideUserTokens(
      {
        user,
        clientId,
        config,
      },
      redirectUri,
    );
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    ConduitGrpcSdk.Metrics?.increment('login_requests_total');
    const scopes = this.constructScopes(
      call.request.params?.scopes ?? this.defaultScopes,
    );
    const payload = await this.connectWithProvider({
      accessToken: call.request.params['access_token'],
      clientId: this.settings.clientId,
      scope: scopes,
    });
    const user = await this.createOrUpdateUser(
      payload,
      call.request.params.invitationToken,
      call.request.context.anonymousUser?._id,
    );
    const config = ConfigController.getInstance().config;
    ConduitGrpcSdk.Metrics?.increment('logged_in_users_total');

    return TokenProvider.getInstance().provideUserTokens({
      user,
      clientId: call.request.context.clientId,
      config,
    });
  }

  async createOrUpdateUser(
    payload: Payload<T>,
    invitationToken?: string,
    anonymousUserId?: string,
  ): Promise<User> {
    let user: User | null = null;
    if (payload.hasOwnProperty('email') && !isNil(payload.email)) {
      user = await User.getInstance().findOne({
        email: payload.email,
      });
    } else if (
      payload.hasOwnProperty('id') &&
      (!payload.hasOwnProperty('email') || isNil(payload.email))
    ) {
      user = await User.getInstance().findOne({
        [this.providerName + '.id']: payload.id,
      });
    } else {
      throw new GrpcError(
        status.INVALID_ARGUMENT,
        'No email or id received from provider',
      );
    }

    let anonymousUser;
    if (anonymousUserId) {
      anonymousUser = await User.getInstance().findOne({
        _id: anonymousUserId,
        isAnonymous: true,
      });
      if (!anonymousUser)
        throw new GrpcError(status.NOT_FOUND, 'Anonymous user not found');
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
      if (!user[this.providerName]) {
        // @ts-ignore
        user[this.providerName] = {};
      }
      // @ts-ignore
      user[this.providerName] = merge(user[this.providerName], payload);
      // TODO look into this again, as the email the user has registered will still not be verified
      if (!user.isVerified) user.isVerified = true;
      user = await User.getInstance().findByIdAndUpdate(user._id, user);
    } else {
      if (anonymousUser) {
        return (await User.getInstance().findByIdAndUpdate(anonymousUser._id, {
          email: payload.email,
          [this.providerName]: payload,
          isVerified: true,
          isAnonymous: false,
        })) as User;
      }
      const teams = ConfigController.getInstance().config.teams;
      if (
        teams.enabled &&
        !teams.allowRegistrationWithoutInvite &&
        isNil(invitationToken)
      ) {
        throw new GrpcError(status.PERMISSION_DENIED, 'Registration requires invitation');
      }
      if (teams.enabled && invitationToken) {
        const valid = await TeamsHandler.getInstance().inviteValidation(
          invitationToken,
          payload.email,
        );
        if (!valid) {
          throw new GrpcError(status.PERMISSION_DENIED, 'Invalid invitation token');
        }
      }
      user = await User.getInstance().create({
        email: payload.email,
        [this.providerName]: payload,
        isVerified: true,
      });
      if (invitationToken) {
        await TeamsHandler.getInstance()
          .addUserToTeam(user, invitationToken)
          .catch(err => {
            ConduitGrpcSdk.Logger.error(err);
          });
      } else {
        await TeamsHandler.getInstance()
          .addUserToDefault(user)
          .catch(err => {
            ConduitGrpcSdk.Logger.error(err);
          });
      }
    }
    return user!;
  }

  declareRoutes(routingManager: RoutingManager) {
    const config = ConfigController.getInstance().config;
    const initRouteMiddleware = ['authMiddleware?', 'checkAnonymousMiddleware'];
    if (config.captcha.enabled && config.captcha.routes.oAuth2) {
      initRouteMiddleware.unshift('captchaMiddleware');
    }
    routingManager.route(
      {
        path: `/init/${this.providerName}`,
        description: `Begins ${this.capitalizeProvider()} authentication.`,
        action: ConduitRouteActions.GET,
        queryParams: {
          scopes: [ConduitString.Optional],
          invitationToken: ConduitString.Optional,
          captchaToken: ConduitString.Optional,
          redirectUri: ConduitString.Optional,
        },
        middlewares: initRouteMiddleware,
      },
      new ConduitRouteReturnDefinition(
        `${this.capitalizeProvider()}InitResponse`,
        'String',
      ),
      this.redirect.bind(this),
    );
    if (this.settings.supportNative) {
      routingManager.route(
        {
          path: `/initNative/${this.providerName}`,
          description: `Begins ${this.capitalizeProvider()} native authentication.`,
          action: ConduitRouteActions.GET,
          queryParams: {
            scopes: [ConduitString.Optional],
            invitationToken: ConduitString.Optional,
            captchaToken: ConduitString.Optional,
          },
          middlewares: initRouteMiddleware,
        },
        new ConduitRouteReturnDefinition(
          `${this.capitalizeProvider()}InitNativeResponse`,
          'String',
        ),
        this.initNative.bind(this),
      );
      routingManager.route(
        {
          path: `/native/${this.providerName}`,
          description: `Completes ${this.capitalizeProvider()} native authentication.`,
          action: ConduitRouteActions.POST,
          bodyParams: {
            code: ConduitString.Required,
            id_token: ConduitString.Required,
            state: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition(`${this.capitalizeProvider()}Response`, {
          accessToken: ConduitString.Optional,
          refreshToken: ConduitString.Optional,
        }),
        this.nativeAuthorize.bind(this),
      );
    }

    if (this.settings.responseMode === 'query') {
      routingManager.route(
        {
          path: `/hook/${this.providerName}`,
          action: ConduitRouteActions.GET,
          description: `Login/register with ${this.capitalizeProvider()} using redirect.`,
          queryParams: {
            code: ConduitString.Required,
            state: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition(`${this.capitalizeProvider()}Response`, {
          accessToken: ConduitString.Optional,
          refreshToken: ConduitString.Optional,
        }),
        this.authorize.bind(this),
      );
    } else {
      routingManager.route(
        {
          path: `/hook/${this.providerName}`,
          action: ConduitRouteActions.POST,
          description: `Login/register with ${this.capitalizeProvider()} using redirect.`,
          bodyParams: {
            code: ConduitString.Required,
            state: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition(`${this.capitalizeProvider()}Response`, {
          accessToken: ConduitString.Optional,
          refreshToken: ConduitString.Optional,
        }),
        this.authorize.bind(this),
      );
    }
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
