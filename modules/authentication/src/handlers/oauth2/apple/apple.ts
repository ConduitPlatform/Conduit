import { OAuth2 } from '../OAuth2.js';
import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  Indexable,
  ParsedRouterRequest,
} from '@conduitplatform/grpc-sdk';
import appleParameters from '../apple/apple.json' with { type: 'json' };
import {
  AppleClientCredentials,
  AppleOAuth2Settings,
  AppleProviderConfig,
  ConnectionParams,
  Payload,
} from '../interfaces/index.js';
import axios from 'axios';
import { AppleUser } from './apple.user.js';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { TokenProvider } from '../../tokenProvider.js';
import { Token } from '../../../models/index.js';
import { status } from '@grpc/grpc-js';
import jwksRsa from 'jwks-rsa';
import {
  validateStateToken,
  resolveAppleOAuthClient,
  validateAppleClients,
  OAUTH_ROUTE_ERRORS,
  redirectOnRegistrationNotAllowed,
  resolveOAuthMode,
} from '../utils/index.js';
import { realmIdOf } from '../../realmRequest.js';
import { RealmContext, StoredRealmStrategies } from '../../../utils/realm.js';
import { anyRealmEnables } from '../../../utils/strategyRealms.js';
import { isGlobalOAuthAvailable } from '../utils/oauthSettings.logic.js';
import { resolveRealmAppleClient } from '../utils/resolveRealmAppleClient.js';
import {
  ConduitJson,
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { OAUTH_CALLBACK } from '../../../constants/index.js';
import { AuthUtils } from '../../../utils/index.js';
import { verifyAppleIdentityToken } from '../../../utils/appleIdentityToken.js';
import { resolveAppleSigningKey } from '../../../utils/appleSigningKey.js';
import { DISCOVERY_RESPONSE_FIELDS, discoverWithOAuth } from '../../realmDiscovery.js';

export class AppleHandlers extends OAuth2<AppleUser, AppleOAuth2Settings> {
  private readonly jwksClient = jwksRsa({
    jwksUri: 'https://appleid.apple.com/auth/keys',
    cache: true,
  });

  constructor(grpcSdk: ConduitGrpcSdk, config: { apple: AppleProviderConfig }) {
    super(grpcSdk, 'apple', new AppleOAuth2Settings(config.apple, appleParameters));
    this.defaultScopes = ['name', 'email'];
  }

  async validate(): Promise<boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (isGlobalOAuthAvailable('apple', authConfig['apple'])) {
      const clients = authConfig['apple'].clients ?? [];
      validateAppleClients(clients);

      ConduitGrpcSdk.Logger.log(`Apple authentication is available`);
      return (this.initialized = true);
    }
    // not available globally: still initialised when a realm enables it, the request
    // paths check the credentials of the realm they resolve
    if (await anyRealmEnables('oauth.apple')) {
      ConduitGrpcSdk.Logger.log(`Apple authentication is available for realms`);
      return (this.initialized = true);
    }
    ConduitGrpcSdk.Logger.log(`Apple authentication not available`);
    return (this.initialized = false);
  }

  /**
   * The Apple client a request runs with. A realm that sets its own `clientId` uses its
   * own credentials (key triple all-or-nothing, else the global triple); otherwise the
   * global `oauthClientId` resolution applies.
   */
  private resolveAppleClient(realmCtx: RealmContext | null, oauthClientId?: string) {
    if (!realmCtx) return resolveAppleOAuthClient(oauthClientId);
    const stored = (realmCtx.settings.strategies as StoredRealmStrategies | undefined)
      ?.oauth?.apple;
    return resolveRealmAppleClient({
      realmClientId: stored?.clientId,
      realmRedirectUri: stored?.redirect_uri,
      effective: realmCtx.effective.strategies.oauth.apple,
      resolveGlobal: () => resolveAppleOAuthClient(oauthClientId),
    });
  }

  // @ts-ignore
  // we don't implement this method for apple provider
  async connectWithProvider(details: ConnectionParams): Promise<Payload<AppleUser>> {}

  constructScopes(scopes: string[]): string {
    return scopes.join(' ');
  }

  protected getInitRouteQueryParams() {
    return {
      ...super.getInitRouteQueryParams(),
      oauthClientId: ConduitString.Optional,
    };
  }

  protected getInitNativeRouteQueryParams() {
    return {
      ...super.getInitNativeRouteQueryParams(),
      oauthClientId: ConduitString.Optional,
    };
  }

  protected resolveOAuthClientId(
    call: ParsedRouterRequest,
    realmCtx: RealmContext | null = null,
  ): string {
    return this.resolveAppleClient(realmCtx, call.request.params?.oauthClientId).clientId;
  }

  protected getOAuthStateExtras(call: ParsedRouterRequest): Record<string, unknown> {
    return { oauthClientId: call.request.params?.oauthClientId };
  }

  async authorize(call: ParsedRouterRequest) {
    const params = call.request.params;
    const stateToken = await validateStateToken(params.state);
    // the realm the flow was started for, re-validated at the callback
    let realmCtx: RealmContext | null;
    try {
      realmCtx = await this.resolveStateRealm(stateToken.data);
    } catch (err) {
      return this.failCallback(err, stateToken);
    }
    const providerClient = this.resolveAppleClient(
      realmCtx,
      stateToken.data.oauthClientId,
    );
    const clientTokenPayload = this.verifyIdentityToken(
      await this.loadPublicKeyFromToken(params.id_token),
      params.id_token,
      providerClient.clientId,
    );

    const apple_client_secret = this.buildAppleClientSecret(providerClient);

    const conduitUrl = (await this.grpcSdk.config.get('router')).hostUrl;
    const config = ConfigController.getInstance().config;
    const tokenBody = new URLSearchParams();
    tokenBody.set('client_id', providerClient.clientId);
    tokenBody.set('client_secret', apple_client_secret);
    tokenBody.set('code', params.code);
    if (this.settings.grantType) {
      tokenBody.set('grant_type', this.settings.grantType);
    }
    tokenBody.set(
      'redirect_uri',
      `${conduitUrl}/hook/authentication/${this.settings.providerName}`,
    );
    const postData = tokenBody.toString();
    const req = {
      method: this.settings.accessTokenMethod,
      url: this.settings.tokenUrl,
      data: postData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };
    const appleResponseToken = await axios(req).catch(err => {
      throw new GrpcError(status.INTERNAL, err.message);
    });

    const data = appleResponseToken.data;
    const id_token = data.id_token;
    const payload = this.verifyIdentityToken(
      await this.loadPublicKeyFromToken(id_token),
      id_token,
      providerClient.clientId,
    );
    if (clientTokenPayload.sub !== payload.sub) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid token');
    }
    const userData = (params.user ?? {}) as Indexable;

    const userParams = {
      id: payload.sub!,
      email: payload.email,
      data: { ...userData, ...payload.email_verified },
    };
    const redirectUri =
      AuthUtils.validateRedirectUri(stateToken.data.customRedirectUri) ??
      providerClient.redirect_uri;
    if (stateToken.data.discover === true) {
      await Token.getInstance().deleteOne(stateToken);
      return this.discoveryRedirect(userParams, redirectUri);
    }
    const conduitClientId = stateToken.data.clientId;
    try {
      const user = await this.createOrUpdateUser(
        userParams,
        stateToken.data.invitationToken,
        stateToken.data.anonymousUserId,
        resolveOAuthMode(stateToken.data.mode),
        realmCtx,
      );
      await Token.getInstance().deleteOne(stateToken);
      return await TokenProvider.getInstance()!.provideUserTokens(
        {
          user,
          clientId: conduitClientId,
          config,
          realm: realmIdOf(realmCtx),
        },
        redirectUri,
      );
    } catch (err) {
      await Token.getInstance().deleteOne(stateToken);
      return redirectOnRegistrationNotAllowed(err, redirectUri);
    }
  }

  async nativeAuthorize(call: ParsedRouterRequest) {
    const params = call.request.bodyParams;
    const stateToken = await validateStateToken(params.state);
    let realmCtx: RealmContext | null;
    try {
      realmCtx = await this.resolveStateRealm(stateToken.data);
    } catch (err) {
      // the native client is an API client, not a browser mid-redirect: it gets the
      // error (with its conduitCode) instead of a redirect
      await Token.getInstance()
        .deleteOne(stateToken)
        .catch(() => undefined);
      throw err;
    }
    const providerClient = this.resolveAppleClient(
      realmCtx,
      stateToken.data.oauthClientId,
    );
    const clientTokenPayload = this.verifyIdentityToken(
      await this.loadPublicKeyFromToken(params.id_token),
      params.id_token,
      providerClient.clientId,
    );

    const apple_client_secret = this.buildAppleClientSecret(providerClient);

    const config = ConfigController.getInstance().config;
    const nativeTokenBody = new URLSearchParams();
    nativeTokenBody.set('client_id', providerClient.clientId);
    nativeTokenBody.set('client_secret', apple_client_secret);
    nativeTokenBody.set('code', params.code);
    if (this.settings.grantType) {
      nativeTokenBody.set('grant_type', this.settings.grantType);
    }
    const postData = nativeTokenBody.toString();
    const req = {
      method: this.settings.accessTokenMethod,
      url: this.settings.tokenUrl,
      data: postData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };
    const appleResponseToken = await axios(req).catch(err => {
      throw new GrpcError(status.INTERNAL, err.message);
    });

    const data = appleResponseToken.data;
    const id_token = data.id_token;
    const payload = this.verifyIdentityToken(
      await this.loadPublicKeyFromToken(id_token),
      id_token,
      providerClient.clientId,
    );
    if (clientTokenPayload.sub !== payload.sub) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid token');
    }
    const userData = (params.user ?? {}) as Indexable;

    const userParams = {
      id: payload.sub!,
      email: payload.email,
      data: { ...userData, ...payload.email_verified },
    };
    if (stateToken.data.discover === true) {
      // the native client is an API client: the answer is the JSON of the discovery
      await Token.getInstance().deleteOne(stateToken);
      return discoverWithOAuth(this.providerName, userParams);
    }
    const user = await this.createOrUpdateUser(
      userParams,
      stateToken.data.invitationToken,
      stateToken.data.anonymousUserId,
      resolveOAuthMode(stateToken.data.mode),
      realmCtx,
    );
    await Token.getInstance().deleteOne(stateToken);

    const conduitClientId = stateToken.data.clientId;

    return TokenProvider.getInstance()!.provideUserTokens({
      user,
      clientId: conduitClientId,
      config,
      realm: realmIdOf(realmCtx),
    });
  }

  declareRoutes(routingManager: RoutingManager) {
    super.declareRoutes(routingManager);
    routingManager.route(
      {
        path: `/hook/apple`,
        action: ConduitRouteActions.POST,
        description: `Login/register with Apple using redirect.`,
        bodyParams: {
          code: ConduitString.Required,
          id_token: ConduitString.Required,
          state: ConduitString.Required,
          user: ConduitJson.Optional,
        },
        errors: OAUTH_ROUTE_ERRORS,
        rateLimit: OAUTH_CALLBACK,
      },
      new ConduitRouteReturnDefinition(`AppleResponse`, {
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
        ...DISCOVERY_RESPONSE_FIELDS,
      }),
      this.authorize.bind(this),
    );
  }

  private async loadPublicKeyFromToken(id_token: string): Promise<string> {
    return resolveAppleSigningKey(id_token, kid => this.jwksClient.getSigningKey(kid));
  }

  private buildAppleClientSecret(providerClient: AppleClientCredentials): string {
    const jwtHeader = {
      alg: 'ES256',
      kid: providerClient.keyId,
    };

    const jwtPayload = {
      iss: providerClient.teamId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
      aud: 'https://appleid.apple.com',
      sub: providerClient.clientId,
    };

    return jwt.sign(jwtPayload, providerClient.privateKey, {
      algorithm: 'ES256',
      header: jwtHeader,
    });
  }

  private verifyIdentityToken(
    applePublicKey: string,
    id_token: string,
    expectedAudience: string,
  ): JwtPayload {
    return verifyAppleIdentityToken(applePublicKey, id_token, expectedAudience);
  }
}
