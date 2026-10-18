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
import {
  assertOAuthRegistrationAllowed,
  OAUTH_MODE_PARAM,
  OAUTH_ROUTE_ERRORS,
  redirectOnRegistrationNotAllowed,
  resolveOAuthMode,
  type OAuthMode,
  validateStateToken,
} from './utils/index.js';
import { IAuthenticationStrategy } from '../../interfaces/index.js';
import { TokenType } from '../../constants/index.js';
import {
  ConduitJson,
  ConduitString,
  ConfigController,
  ModuleError,
  RoutingManager,
} from '@conduitplatform/module-tools';
import {
  OAUTH_CALLBACK,
  OAUTH_INIT,
  OAUTH_NATIVE_COMPLETE,
} from '../../constants/index.js';
import { AuthUtils } from '../../utils/index.js';
import { assertEmailAllowed } from '../../utils/emailRestrictions.js';
import { errors } from '../../errors.js';
import {
  assertAnonymousUserInRealm,
  assertStrategyEnabledForRealm,
  grantHomeMembershipForRegistration,
  homeRealmFields,
  isInviteRequired,
  realmIdOf,
  realmParam,
  resolveInvitationRealm,
  resolveRealmFromSlug,
  rollbackUserOnFailure,
  scopedUserQuery,
} from '../realmRequest.js';
import {
  RealmContext,
  realmsEnabled,
  RealmOAuthProviderKey,
  resolveRealmById,
} from '../../utils/realm.js';
import { anyRealmEnables } from '../../utils/strategyRealms.js';
import {
  hasCompleteOAuthCredentials,
  isGlobalOAuthAvailable,
  OAuthSettingsCache,
  pickCallbackRedirect,
  settingsForRealm,
  stateRealmRef,
} from './utils/oauthSettings.logic.js';

/**
 * Base of the OAuth2 providers.
 *
 * Realms override the credentials (`clientId`, `clientSecret`, `redirect_uri`,
 * `accountLinking`) per provider, nothing else: the static provider parameters, the PKCE
 * `codeVerifier` and, for Microsoft, the `tenantId` baked into the endpoint URLs are
 * global per handler and shared by every realm.
 */
export abstract class OAuth2<
  T,
  S extends OAuth2Settings,
> implements IAuthenticationStrategy {
  grpcSdk: ConduitGrpcSdk;
  initialized: boolean = false;
  mapScopes: { [key: string]: string };
  defaultScopes: string[];
  protected settings: S;
  protected readonly providerName: string;
  private readonly realmSettings = new OAuthSettingsCache<S>();

  protected constructor(grpcSdk: ConduitGrpcSdk, providerName: string, settings: S) {
    this.providerName = providerName;
    this.grpcSdk = grpcSdk;
    this.settings = settings;
    this.settings.provider = providerName;
  }

  async validate(): Promise<boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (isGlobalOAuthAvailable(this.providerName, authConfig[this.providerName])) {
      ConduitGrpcSdk.Logger.log(`${this.providerName} authentication is available`);
      return (this.initialized = true);
    }
    // not available globally: still initialised when a realm enables it, the request
    // paths check the credentials of the realm they resolve
    if (await anyRealmEnables(`oauth.${this.providerName}`)) {
      ConduitGrpcSdk.Logger.log(
        `${this.providerName} authentication is available for realms`,
      );
      return (this.initialized = true);
    }
    ConduitGrpcSdk.Logger.log(`${this.providerName} authentication not available`);
    return (this.initialized = false);
  }

  /**
   * The OAuth settings a request runs with: the handler's own (global) settings, or for
   * a realm the same provider parameters with the realm's effective credentials
   * (`clientId`, `clientSecret`, `redirect_uri` -> `finalRedirect`, `accountLinking`).
   * Cached per realm and credential version; see `invalidateOAuthSettingsCache`.
   */
  protected getSettingsFor(ctx: RealmContext | null): S {
    return settingsForRealm({
      globalSettings: this.settings,
      realm: ctx
        ? {
            id: String(ctx.team._id),
            effective:
              ctx.effective.strategies.oauth[this.providerName as RealmOAuthProviderKey],
          }
        : null,
      cache: this.realmSettings,
      build: effective => this.buildRealmSettings(effective),
      // fail closed: a realm without an entry for this provider must never fall back to
      // the global credentials
      missing: () => new ModuleError(errors.STRATEGY_NOT_AVAILABLE_FOR_REALM),
    });
  }

  /** The global settings (static provider params, PKCE verifier) with realm credentials. */
  protected buildRealmSettings(effective: {
    clientId: string;
    clientSecret: string;
    redirect_uri: string;
    accountLinking: boolean;
  }): S {
    const settings: S = Object.assign(
      Object.create(Object.getPrototypeOf(this.settings)),
      this.settings,
    );
    settings.clientId = effective.clientId;
    settings.clientSecret = effective.clientSecret;
    settings.finalRedirect = effective.redirect_uri;
    settings.accountLinking = effective.accountLinking;
    return settings;
  }

  protected resolveOAuthClientId(
    _call: ParsedRouterRequest,
    realmCtx: RealmContext | null = null,
  ): string {
    void _call;
    return this.getSettingsFor(realmCtx).clientId;
  }

  protected getOAuthStateExtras(_call: ParsedRouterRequest): Record<string, unknown> {
    void _call;
    return {};
  }

  /**
   * Resolves the realm a request names and checks that it enables this provider. No
   * slug means global.
   */
  protected async resolveRealmContext(slug: unknown): Promise<RealmContext | null> {
    return this.checkRealmContext(await resolveRealmFromSlug(slug));
  }

  /**
   * Resolves the realm a state token was created for (callback). By team id when the
   * token has one, so a slug rename mid-flow does not break the flow; tokens created
   * before the id was stored fall back to the slug.
   */
  protected async resolveStateRealm(
    data: Record<string, unknown> | null | undefined,
  ): Promise<RealmContext | null> {
    const ref = stateRealmRef(data);
    if (!ref) return this.checkRealmContext(null);
    if ('slug' in ref) return this.resolveRealmContext(ref.slug);
    if (!realmsEnabled()) throw new ModuleError(errors.REALMS_DISABLED);
    return this.checkRealmContext(await resolveRealmById(ref.id));
  }

  /** Checks that the realm (or global, for null) can run this provider. */
  protected checkRealmContext(realmCtx: RealmContext | null): RealmContext | null {
    assertStrategyEnabledForRealm(realmCtx, `oauth.${this.providerName}`);
    if (realmCtx) {
      // enabled by the realm, but neither the realm nor the global config can sign in
      const effective =
        realmCtx.effective.strategies.oauth[this.providerName as RealmOAuthProviderKey];
      if (!hasCompleteOAuthCredentials(this.providerName, effective)) {
        throw new ModuleError(errors.STRATEGY_NOT_AVAILABLE_FOR_REALM);
      }
    } else if (
      !isGlobalOAuthAvailable(
        this.providerName,
        ConfigController.getInstance().config[this.providerName],
      )
    ) {
      // the routes exist because a realm enables the provider: global calls are refused
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
    }
    return realmCtx;
  }

  /**
   * Where a callback that fails on realm resolution sends the browser: the validated
   * `customRedirectUri` of the flow, else the realm's own `redirect_uri` (the realm is
   * looked up without validating the provider), else the global `finalRedirect`.
   */
  protected async callbackFallbackRedirect(
    data: Record<string, unknown> | null | undefined,
  ): Promise<string | undefined> {
    let custom: string | undefined;
    try {
      custom = AuthUtils.validateRedirectUri(data?.customRedirectUri as string);
    } catch {
      custom = undefined;
    }
    let realmRedirect: string | undefined;
    const ref = stateRealmRef(data);
    if (ref) {
      try {
        const ctx =
          'slug' in ref
            ? await resolveRealmFromSlug(ref.slug)
            : realmsEnabled()
              ? await resolveRealmById(ref.id)
              : null;
        realmRedirect =
          ctx?.effective.strategies.oauth[this.providerName as RealmOAuthProviderKey]
            ?.redirect_uri;
      } catch {
        realmRedirect = undefined;
      }
    }
    return pickCallbackRedirect([custom, realmRedirect, this.settings.finalRedirect]);
  }

  /**
   * A realm failure at the callback: the state token is spent and the error is sent to
   * the app as a `conduitCode` redirect when it is one the redirect flow reports
   * (STRATEGY_NOT_AVAILABLE_FOR_REALM, REALM_ACCESS_DENIED...), otherwise it is thrown.
   */
  protected async failCallback(
    err: unknown,
    stateToken: Token,
  ): Promise<{ redirect: string }> {
    await Token.getInstance()
      .deleteOne(stateToken)
      .catch(() => undefined);
    return redirectOnRegistrationNotAllowed(
      err,
      await this.callbackFallbackRedirect(stateToken.data),
    );
  }

  async initNative(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const scopes = call.request.params?.scopes ?? this.defaultScopes;
    const { anonymousUser } = call.request.context;
    const realmCtx = await this.resolveRealmContext(call.request.params?.realm);
    const settings = this.getSettingsFor(realmCtx);
    const conduitUrl = (await this.grpcSdk.config.get('router')).hostUrl;

    // returns part of regular redirect options for native usage
    const queryOptions: Partial<RedirectOptions> = {
      client_id: this.resolveOAuthClientId(call, realmCtx),
      redirect_uri: conduitUrl + settings.callbackUrl,
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
          mode: resolveOAuthMode(call.request.params?.mode),
          ...(realmCtx
            ? { realm: realmCtx.team.realm!.slug, realmId: realmIdOf(realmCtx) }
            : {}),
          ...this.getOAuthStateExtras(call),
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
    const realmCtx = await this.resolveRealmContext(call.request.params?.realm);
    const settings = this.getSettingsFor(realmCtx);
    const conduitUrl = (await this.grpcSdk.config.get('router')).hostUrl;
    let codeChallenge;
    if (!isNil(settings.codeChallengeMethod)) {
      codeChallenge = createHash('sha256')
        .update(settings.codeVerifier!)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    }
    const queryOptions: RedirectOptions = {
      client_id: this.resolveOAuthClientId(call, realmCtx),
      redirect_uri: conduitUrl + settings.callbackUrl,
      response_type: settings.responseType,
      response_mode: settings.responseMode,
      scope: this.constructScopes(scopes),
      ...(codeChallenge !== undefined && { code_challenge: codeChallenge }),
      ...(settings.codeChallengeMethod !== undefined && {
        code_challenge_method: settings.codeChallengeMethod,
      }),
    };
    const baseUrl = settings.authorizeUrl.endsWith('?')
      ? settings.authorizeUrl.slice(0, -1)
      : settings.authorizeUrl;
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
          mode: resolveOAuthMode(call.request.params?.mode),
          ...(realmCtx
            ? { realm: realmCtx.team.realm!.slug, realmId: realmIdOf(realmCtx) }
            : {}),
          ...this.getOAuthStateExtras(call),
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
    // the realm the flow was started for, re-validated at the callback
    let realmCtx: RealmContext | null;
    try {
      realmCtx = await this.resolveStateRealm(stateToken.data);
    } catch (err) {
      return this.failCallback(err, stateToken);
    }
    const settings = this.getSettingsFor(realmCtx);
    const conduitUrl = (await this.grpcSdk.config.get('router')).hostUrl;
    const config = ConfigController.getInstance().config;
    const myParams: AuthParams = {
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      code: params.code,
      redirect_uri: `${conduitUrl}/hook/authentication/${settings.providerName}`,
    };

    if (settings.hasOwnProperty('grantType')) {
      myParams['grant_type'] = settings.grantType;
    }
    if (!isNil(settings.codeChallengeMethod)) {
      myParams['code_verifier'] = settings.codeVerifier;
    }

    const providerOptions = this.makeRequest(myParams, settings);
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
      providerClientId: settings.clientId,
    }).catch(err => {
      ConduitGrpcSdk.Logger.error(JSON.stringify(err.response.data));
      throw new GrpcError(status.INTERNAL, err.message);
    });

    await Token.getInstance().deleteOne(stateToken);
    const redirectUri =
      AuthUtils.validateRedirectUri(stateToken.data.customRedirectUri) ??
      settings.finalRedirect;
    try {
      const user = await this.createOrUpdateUser(
        payload,
        stateToken.data.invitationToken,
        stateToken.data.anonymousUserId,
        resolveOAuthMode(stateToken.data.mode),
        realmCtx,
      );
      return await TokenProvider.getInstance().provideUserTokens(
        {
          user,
          clientId,
          config,
          realm: realmIdOf(realmCtx),
        },
        redirectUri,
      );
    } catch (err) {
      return redirectOnRegistrationNotAllowed(err, redirectUri);
    }
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    ConduitGrpcSdk.Metrics?.increment('login_requests_total');
    const realmCtx = await this.resolveRealmContext(call.request.params?.realm);
    const settings = this.getSettingsFor(realmCtx);
    const scopes = this.constructScopes(
      call.request.params?.scopes ?? this.defaultScopes,
    );
    const payload = await this.connectWithProvider({
      accessToken: call.request.params['access_token'],
      clientId: settings.clientId,
      scope: scopes,
      providerClientId: settings.clientId,
    });
    const user = await this.createOrUpdateUser(
      payload,
      call.request.params.invitationToken,
      call.request.context.anonymousUser?._id,
      resolveOAuthMode(call.request.params?.mode),
      realmCtx,
    );
    const config = ConfigController.getInstance().config;
    return TokenProvider.getInstance().provideUserTokens({
      user,
      clientId: call.request.context.clientId,
      config,
      realm: realmIdOf(realmCtx),
    });
  }

  async createOrUpdateUser(
    payload: Payload<T>,
    invitationToken?: string,
    anonymousUserId?: string,
    mode: OAuthMode = 'both',
    realmCtx: RealmContext | null = null,
  ): Promise<User> {
    let user: User | null = null;
    if (payload.hasOwnProperty('email') && !isNil(payload.email)) {
      user = await User.getInstance().findOne(
        scopedUserQuery({ email: payload.email }, realmCtx),
      );
      if (isNil(user) && (realmCtx || realmsEnabled())) {
        // email is unique across realms: the address belongs to a user of another one
        const otherRealmUser = await User.getInstance().findOne({
          email: payload.email,
        });
        if (otherRealmUser) throw new ModuleError(errors.REALM_ACCESS_DENIED);
      }
    } else if (
      payload.hasOwnProperty('id') &&
      (!payload.hasOwnProperty('email') || isNil(payload.email))
    ) {
      user = await User.getInstance().findOne(
        scopedUserQuery({ [this.providerName + '.id']: payload.id }, realmCtx),
      );
      if (isNil(user) && (realmCtx || realmsEnabled())) {
        // provider identities are unique across realms: the id belongs to a user of
        // another one
        const otherRealmUser = await User.getInstance().findOne({
          [this.providerName + '.id']: payload.id,
        });
        if (otherRealmUser) throw new ModuleError(errors.REALM_ACCESS_DENIED);
      }
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
      const accountLinking = realmCtx
        ? (realmCtx.effective.strategies.oauth[this.providerName as RealmOAuthProviderKey]
            ?.accountLinking ?? this.settings.accountLinking)
        : this.settings.accountLinking;
      if (!accountLinking) {
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
      assertOAuthRegistrationAllowed(mode, invitationToken);
      if (payload.email) {
        assertEmailAllowed(payload.email);
      }
      if (anonymousUser) {
        assertAnonymousUserInRealm(anonymousUser, realmCtx);
        return (await User.getInstance().findByIdAndUpdate(anonymousUser._id, {
          email: payload.email,
          [this.providerName]: payload,
          isVerified: true,
          isAnonymous: false,
        })) as User;
      }
      const teams = ConfigController.getInstance().config.teams;
      if (
        isInviteRequired(realmCtx?.effective.registration, teams) &&
        isNil(invitationToken)
      ) {
        throw new GrpcError(status.PERMISSION_DENIED, 'Registration requires invitation');
      }
      if ((teams.enabled || realmCtx) && invitationToken) {
        const valid = await TeamsHandler.getInstance().inviteValidation(
          invitationToken,
          payload.email,
        );
        if (!valid) {
          throw new GrpcError(status.PERMISSION_DENIED, 'Invalid invitation token');
        }
        // an invitation into a realm must agree with the realm being registered at
        await resolveInvitationRealm(realmCtx, invitationToken);
      }
      user = await User.getInstance().create({
        email: payload.email,
        [this.providerName]: payload,
        isVerified: true,
        ...homeRealmFields(realmCtx),
      });
      if (realmCtx) {
        // an invitation into the realm creates the team relation itself, otherwise the
        // user becomes a plain member of the realm team
        const createdUser = user;
        await rollbackUserOnFailure(this.grpcSdk, createdUser, () =>
          grantHomeMembershipForRegistration(
            this.grpcSdk,
            createdUser,
            realmCtx,
            invitationToken,
          ),
        );
      }
      if (invitationToken) {
        await TeamsHandler.getInstance()
          .addUserToTeam(user, invitationToken)
          .catch(err => {
            ConduitGrpcSdk.Logger.error(err);
          });
      } else if (!realmCtx) {
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
        description: `Begins ${this.capitalizeProvider()} authentication. Optional mode: "both" (default, login and register) or "signIn" (existing users only; invitation tokens still register).`,
        action: ConduitRouteActions.GET,
        queryParams: this.getInitRouteQueryParams(),
        middlewares: initRouteMiddleware,
        rateLimit: OAUTH_INIT,
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
          description: `Begins ${this.capitalizeProvider()} native authentication. Optional mode: "both" (default, login and register) or "signIn" (existing users only; invitation tokens still register).`,
          action: ConduitRouteActions.GET,
          queryParams: this.getInitNativeRouteQueryParams(),
          middlewares: initRouteMiddleware,
          rateLimit: OAUTH_INIT,
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
            user: ConduitJson.Optional,
          },
          errors: OAUTH_ROUTE_ERRORS,
          rateLimit: OAUTH_NATIVE_COMPLETE,
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
          errors: OAUTH_ROUTE_ERRORS,
          rateLimit: OAUTH_CALLBACK,
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
          errors: OAUTH_ROUTE_ERRORS,
          rateLimit: OAUTH_CALLBACK,
        },
        new ConduitRouteReturnDefinition(`${this.capitalizeProvider()}Response`, {
          accessToken: ConduitString.Optional,
          refreshToken: ConduitString.Optional,
        }),
        this.authorize.bind(this),
      );
    }
  }

  protected getInitRouteQueryParams() {
    return {
      scopes: [ConduitString.Optional],
      invitationToken: ConduitString.Optional,
      captchaToken: ConduitString.Optional,
      redirectUri: ConduitString.Optional,
      mode: OAUTH_MODE_PARAM,
      realm: realmParam,
    };
  }

  protected getInitNativeRouteQueryParams() {
    return {
      scopes: [ConduitString.Optional],
      invitationToken: ConduitString.Optional,
      captchaToken: ConduitString.Optional,
      mode: OAUTH_MODE_PARAM,
      realm: realmParam,
    };
  }

  makeRequest(data: AuthParams, settings: OAuth2Settings = this.settings): OAuthRequest {
    return {
      method: settings.accessTokenMethod,
      url: settings.tokenUrl,
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
