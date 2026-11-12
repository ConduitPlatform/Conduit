import { isNil } from 'lodash-es';
import moment from 'moment';
import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ParsedRouterRequest,
  TYPE,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { RefreshToken, Token, TwoFactorSecret, User } from '../models/index.js';
import { IAuthenticationStrategy } from '../interfaces/index.js';
import { Config } from '../config/index.js';
import { TokenProvider } from './tokenProvider.js';
import {
  ConduitDate,
  ConduitString,
  ConfigController,
  RoutingManager,
  authErrors,
  ModuleError,
} from '@conduitplatform/module-tools';
import { errors } from '../errors.js';
import {
  AUTHENTICATED_TOKEN_ERRORS,
  SESSION_AUTH_ERRORS,
  TOKEN_ISSUANCE_ERRORS,
} from './utils.js';
import * as node2fa from '@conduitplatform/node-2fa';
import { AuthUtils } from '../utils/index.js';
import {
  deleteUserRealmMemberships,
  resolveRefreshPolicyForRealm,
} from '../utils/realm.js';
import {
  effectiveMaxExpiresOn,
  extendRefreshToken,
  hashRefreshToken,
} from '../utils/refreshToken.logic.js';
import { legacyRefreshDefaults, legacyRowPatch } from '../utils/refreshTokenMigration.js';
import { REFRESH_SCHEMA_DEFAULTS } from '../migrations/index.js';
import { AUTH_CREDENTIALS, TokenType } from '../constants/index.js';
import { performSudo } from './sudo.service.js';
import { sessionRealmId } from './realmRequest.js';
import {
  getRedisKeyValue,
  getSessionRegistry,
  revokeSessions,
} from '../utils/sessionServices.js';
import { isSyntheticSid } from './tokenClaims.logic.js';
import { invalidateTeamClaims } from '../utils/teamClaims.js';
import getToken = AuthUtils.getToken;

export class CommonHandlers implements IAuthenticationStrategy {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  /**
   * Looks a presented refresh token up by its hash and validates it (client match,
   * expiry, user state). Shared by /renew and /renew/extend. A row that still holds a
   * plaintext token (not yet migrated) is found by it and migrated on the spot.
   */
  private async findValidRefreshToken(
    call: ParsedRouterRequest,
  ): Promise<RefreshToken & { user: User }> {
    const { refreshToken, clientId } = call.request.context;
    if (isNil(refreshToken) || refreshToken === '') {
      throw new ModuleError(errors.REFRESH_TOKEN_INVALID);
    }
    const presented = String(refreshToken);
    let row: RefreshToken | null = await RefreshToken.getInstance().findOne(
      { tokenHash: hashRefreshToken(presented), clientId },
      { populate: ['user'], readPreference: 'primary' },
    );
    if (isNil(row)) {
      row = await this.migrateLegacyRefreshToken(presented, clientId);
    }
    if (isNil(row)) {
      throw new ModuleError(errors.REFRESH_TOKEN_INVALID);
    }
    const now = moment.utc();
    if (
      now.isAfter(moment.utc(row.expiresOn)) ||
      (row.maxExpiresOn && now.isAfter(moment.utc(row.maxExpiresOn)))
    ) {
      throw new ModuleError(errors.REFRESH_TOKEN_INVALID, 'expired');
    }
    if (!row.user) {
      throw new ModuleError(authErrors.USER_BLOCKED, 'refresh token has no user');
    }
    if (!(row.user as User).active) {
      throw new ModuleError(authErrors.USER_BLOCKED);
    }
    return row as RefreshToken & { user: User };
  }

  /** Legacy fallback: a row still stored by plaintext token is hashed and returned. */
  private async migrateLegacyRefreshToken(
    presented: string,
    clientId: string,
  ): Promise<RefreshToken | null> {
    const legacy = await RefreshToken.getInstance().findOne(
      { token: presented, clientId },
      { select: '+token', populate: ['user'], readPreference: 'primary' },
    );
    if (isNil(legacy)) return null;
    const config = ConfigController.getInstance().config;
    const defaults = legacyRefreshDefaults(config.refreshTokens, REFRESH_SCHEMA_DEFAULTS);
    const patch = legacyRowPatch(legacy as never, defaults);
    await RefreshToken.getInstance().findByIdAndUpdate(legacy._id, patch as never);
    return { ...legacy, ...patch } as RefreshToken;
  }

  /**
   * Mints a new access token for a valid refresh token. The refresh token is neither
   * rotated nor deleted; `refreshToken` in the response is the presented token,
   * unchanged (clients may ignore it).
   */
  async renewAuth(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { clientId, refreshToken } = call.request.context;
    const config = ConfigController.getInstance().config;
    const row = await this.findValidRefreshToken(call);

    return TokenProvider.getInstance().provideRenewedAccessToken(
      {
        user: row.user,
        clientId,
        config,
        // the session stays in the realm it was issued for; issuance re-checks access
        realm: row.realm ? String(row.realm) : null,
      },
      row,
      String(refreshToken),
    );
  }

  /**
   * Extends the refresh token: expiresOn = min(now + effective expiryPeriod, cap), where
   * the cap honors a policy tightened after mint. Refused (FAILED_PRECONDITION) when the
   * token or the policy in force is not extendable. With refresh cookies on, the cookie is
   * re-set with the new lifetime.
   */
  async extendRefresh(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const config = ConfigController.getInstance().config;
    const row = await this.findValidRefreshToken(call);
    const policy = await resolveRefreshPolicyForRealm(
      row.realm ? String(row.realm) : null,
      config,
    );
    const now = Date.now();
    const decision = extendRefreshToken({
      now,
      expiryPeriod: policy.expiryPeriod,
      maxExpiresOn: effectiveMaxExpiresOn(row, policy.maxLifetime),
      extendable: row.extendable !== false && policy.extendable,
    });
    if (!decision.ok) {
      throw new ModuleError(errors.REFRESH_TOKEN_NOT_EXTENDABLE);
    }
    await RefreshToken.getInstance().findByIdAndUpdate(row._id, {
      expiresOn: decision.expiresOn,
    });
    // the registry entry lives as long as the refresh token (best effort: a lost entry
    // only matters with strict revocation, which then asks for a new login)
    try {
      const registry = getSessionRegistry();
      if (!registry) throw new Error('Session registry unavailable');
      await registry.touch(String(row._id), decision.expiresOn.getTime() - now);
    } catch (e) {
      ConduitGrpcSdk.Logger.warn(
        `Session registry touch failed: ${(e as Error)?.message ?? e}`,
      );
    }
    if (config.refreshTokens.setCookie) {
      return {
        result: { expiresOn: decision.expiresOn },
        setCookies: [
          {
            name: 'refreshToken',
            value: String(call.request.context.refreshToken),
            options: {
              ...config.refreshTokens.cookieOptions,
              maxAge: Math.max(
                0,
                Math.floor((decision.expiresOn.getTime() - now) / 1000),
              ),
            },
          },
        ],
      };
    }
    return { expiresOn: decision.expiresOn };
  }

  /** The sudo state store: the shared state manager plus an atomic SET NX on Redis. */
  private sudoState() {
    const state = this.grpcSdk.state;
    if (!state) return null;
    return {
      getKey: (key: string) => state.getKey(key),
      setKey: (key: string, value: string, expiryMs?: number) =>
        state.setKey(key, value, expiryMs),
      clearKey: (key: string) => state.clearKey(key),
      setIfAbsent: async (key: string, value: string, expiryMs: number) => {
        // the shared client (getClient() would open a connection per attempt)
        const redis = getRedisKeyValue();
        if (!redis) {
          throw new ModuleError(errors.STEP_UP_UNAVAILABLE, 'redis client missing');
        }
        let reply: unknown;
        try {
          reply = await redis.set(key, value, 'PX', expiryMs, 'NX');
        } catch (e) {
          throw ModuleError.from(e, errors.STEP_UP_UNAVAILABLE);
        }
        return reply === 'OK';
      },
    };
  }

  /**
   * Step-up: the user re-proves their credentials and gets an access token with sudo.
   * A user with 2FA must present a valid second factor (a password alone never works);
   * SMS users go through a challenge. Creates no refresh token.
   */
  async sudo(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { password, code } = call.request.params;
    const context = call.request.context;
    const config: Config = ConfigController.getInstance().config;
    const sms = () => {
      if (!this.grpcSdk.sms) {
        throw new ModuleError(errors.PHONE_PROVIDER_UNAVAILABLE);
      }
      return this.grpcSdk.sms;
    };
    return performSudo<User>(
      {
        state: this.sudoState(),
        now: () => Date.now(),
        loadUser: () =>
          User.getInstance().findOne(
            { _id: context.user._id },
            { select: '+hashedPassword', readPreference: 'primary' },
          ),
        checkPassword: AuthUtils.checkPassword,
        getTotpSecret: async user => {
          const secret = await TwoFactorSecret.getInstance().findOne(
            { user: user._id },
            { readPreference: 'primary' },
          );
          return secret?.secret ?? null;
        },
        verifyTotp: (secret, totp) => {
          const verification = node2fa.verifyToken(secret, totp, 1);
          return isNil(verification) ? null : verification.delta;
        },
        sendSmsChallenge: async user => {
          const sid = await AuthUtils.sendVerificationCode(sms(), user.phoneNumber!);
          if (sid === '') {
            throw new ModuleError(errors.VERIFICATION_CODE_SEND_FAILED);
          }
          await Token.getInstance()
            .deleteMany({
              user: user._id,
              tokenType: TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
            })
            .catch(e => ConduitGrpcSdk.Logger.error(e));
          await Token.getInstance().create({
            user: user._id,
            tokenType: TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
            token: sid,
          });
        },
        verifySms: async (user, smsCode) => {
          const token = await Token.getInstance().findOne(
            {
              tokenType: TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
              user: user._id,
            },
            { readPreference: 'primary' },
          );
          if (!token) return false;
          const verified = await sms().verify(
            token.data?.verification ?? token.token,
            smsCode,
          );
          if (!verified.verified) return false;
          const consumed = await Token.getInstance().deleteOne({
            _id: token._id,
            user: user._id,
            tokenType: TokenType.PHONE_TWO_FA_VERIFICATION_TOKEN,
          });
          return consumed.deletedCount !== 0;
        },
        mint: user =>
          TokenProvider.getInstance().provideSudoAccessToken({
            user,
            clientId: context.clientId,
            config,
            realm: sessionRealmId(context),
            sessionId: context.sessionId ?? null,
          }),
      },
      { password, code },
    );
  }

  async logOut(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    const clientId = context.clientId;
    const user = context.user;
    const config: Config = ConfigController.getInstance().config;
    const authToken = getToken(call.request.headers, call.request.cookies, 'access');
    const clientConfig = config.clients;
    await TokenProvider.getInstance().logOutClientOperations(
      this.grpcSdk,
      clientConfig,
      authToken!,
      clientId,
      user._id,
    );

    // the middleware sets the session id on the request context (the refresh token id,
    // or the uuid of a jwt session without a refresh token)
    if (context.sessionId) {
      const sid = String(context.sessionId);
      // a uuid session id (jwt session without a refresh row) is no row id: looking it
      // up would be a cast error on MongoDB. Whatever happens to the row, the registry
      // entry is always revoked.
      if (!isSyntheticSid(sid)) {
        try {
          // scoped to the user: a session id never ends someone else's session
          await RefreshToken.getInstance().deleteOne({ _id: sid, user: user._id });
        } catch (e) {
          ConduitGrpcSdk.Logger.warn(
            `Refresh token delete on logout failed: ${(e as Error)?.message ?? e}`,
          );
        }
      }
      await revokeSessions([sid], 'logout');
    }

    if (!clientConfig.multipleUserSessions) {
      TokenProvider.getInstance().trackLoggedOutUserMetric(user._id);
    }
    const removeCookies = [];
    if (config.refreshTokens.enabled && config.refreshTokens.setCookie) {
      removeCookies.push({
        name: 'refreshToken',
        options: config.refreshTokens.cookieOptions,
      });
    }
    if (config.accessTokens.setCookie) {
      removeCookies.push({
        name: 'accessToken',
        options: config.accessTokens.cookieOptions,
      });
    }
    if (removeCookies.length > 0) {
      return {
        result: 'LoggedOut',
        removeCookies,
      };
    }
    return 'LoggedOut';
  }

  async getUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    return call.request.context.user;
  }

  async deleteUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user, jwtPayload } = call.request.context;
    if (!jwtPayload.sudo) {
      throw new ModuleError(errors.SUDO_REQUIRED);
    }
    await User.getInstance().deleteOne({ _id: user._id });
    await deleteUserRealmMemberships(String(user._id));
    await this.grpcSdk.authorization!.deleteAllRelations({
      resource: 'User:' + user._id,
    });
    await this.grpcSdk.authorization!.deleteAllRelations({
      subject: 'User:' + user._id,
    });
    await invalidateTeamClaims([String(user._id)]);
    // every session of the deleted user ends, not only the current one
    await TokenProvider.getInstance().deleteUserTokens({ user: String(user._id) });

    return this.logOut(call);
  }

  async updateUser(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { user } = call.request.context;
    const { userData } = call.request.bodyParams;
    AuthUtils.checkUserData(userData);
    const updatedUser = await User.getInstance().findByIdAndUpdate(user._id, userData);
    return updatedUser!;
  }

  declareRoutes(routingManager: RoutingManager): void {
    routingManager.route(
      {
        path: '/user',
        description: `Returns the authenticated user.`,
        action: ConduitRouteActions.GET,
        errors: [...SESSION_AUTH_ERRORS],
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition(User.name),
      this.getUser.bind(this),
    );
    routingManager.route(
      {
        path: '/user',
        description: 'Deletes the authenticated user.',
        action: ConduitRouteActions.DELETE,
        errors: [errors.SUDO_REQUIRED, ...SESSION_AUTH_ERRORS],
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('DeleteUserResponse', 'String'),
      this.deleteUser.bind(this),
    );
    routingManager.route(
      {
        path: '/user',
        description: `Updates user.`,
        action: ConduitRouteActions.PATCH,
        bodyParams: {
          userData: {
            type: TYPE.JSON,
            required: true,
            description:
              'Fields to update that should not overwrite the User schema fields.',
          },
        },
        errors: [errors.USER_DATA_INVALID, ...SESSION_AUTH_ERRORS],
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition(User.name),
      this.updateUser.bind(this),
    );
    const config = ConfigController.getInstance().config;
    if (config.refreshTokens.enabled) {
      routingManager.route(
        {
          path: '/renew',
          action: ConduitRouteActions.POST,
          description:
            'Issues a new access token. The refresh token is not rotated: `refreshToken` in the response is the presented token, unchanged (clients may ignore it). ' +
            `Requires a valid refresh token provided in Authorization header/cookie. Format 'Bearer TOKEN'`,
          errors: [
            errors.REFRESH_TOKEN_INVALID,
            authErrors.AUTH_TOKEN_MISSING,
            authErrors.AUTH_HEADER_MALFORMED,
            ...TOKEN_ISSUANCE_ERRORS,
          ],
          middlewares: ['refreshAuthMiddleware'],
        },
        new ConduitRouteReturnDefinition('RenewAuthenticationResponse', {
          accessToken: ConduitString.Required,
          refreshToken: ConduitString.Optional,
        }),
        this.renewAuth.bind(this),
      );
      routingManager.route(
        {
          path: '/renew/extend',
          action: ConduitRouteActions.POST,
          description:
            'Extends the refresh token expiry, capped by its absolute maximum lifetime. ' +
            `Requires a valid refresh token provided in Authorization header/cookie. Format 'Bearer TOKEN'`,
          errors: [
            errors.REFRESH_TOKEN_NOT_EXTENDABLE,
            errors.REFRESH_TOKEN_INVALID,
            authErrors.USER_BLOCKED,
            authErrors.AUTH_TOKEN_MISSING,
            authErrors.AUTH_HEADER_MALFORMED,
          ],
          middlewares: ['refreshAuthMiddleware'],
        },
        new ConduitRouteReturnDefinition('ExtendRefreshTokenResponse', {
          expiresOn: ConduitDate.Required,
        }),
        this.extendRefresh.bind(this),
      );
    }

    routingManager.route(
      {
        path: '/sudo',
        action: ConduitRouteActions.POST,
        description:
          'Step-up authentication. Users without 2FA present their password; users with authenticator 2FA a TOTP code (password optional); users with SMS 2FA call without a code to receive a challenge ({ challenge: "sms" }), then again with the code. Returns an access token with sudo. No refresh token is issued. Repeated failures lock the route for 15 minutes.',
        bodyParams: {
          password: ConduitString.Optional,
          code: ConduitString.Optional,
        },
        errors: [
          errors.SUDO_LOCKED_OUT,
          errors.INVALID_CREDENTIALS,
          errors.SUDO_PASSWORD_REQUIRED,
          errors.SUDO_CODE_REQUIRED,
          errors.PASSWORD_AUTH_NOT_AVAILABLE,
          errors.TWO_FA_METHOD_UNAVAILABLE,
          errors.PHONE_PROVIDER_UNAVAILABLE,
          errors.STEP_UP_UNAVAILABLE,
          errors.VERIFICATION_CODE_SEND_FAILED,
          ...SESSION_AUTH_ERRORS,
          ...AUTHENTICATED_TOKEN_ERRORS,
        ],
        middlewares: ['authMiddleware'],
        rateLimit: AUTH_CREDENTIALS,
      },
      new ConduitRouteReturnDefinition('SudoResponse', {
        accessToken: ConduitString.Required,
      }),
      this.sudo.bind(this),
    );

    routingManager.route(
      {
        path: '/logout',
        action: ConduitRouteActions.POST,
        description: 'Logs out authenticated user.',
        errors: [...SESSION_AUTH_ERRORS],
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('LogoutResponse', 'String'),
      this.logOut.bind(this),
    );
  }

  validate(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
