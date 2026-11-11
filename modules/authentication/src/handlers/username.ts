import { isNil } from 'lodash-es';
import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { IAuthenticationStrategy } from '../interfaces/index.js';
import { TokenProvider } from './tokenProvider.js';
import {
  ConduitBoolean,
  ConduitString,
  ConfigController,
  RoutingManager,
  ModuleError,
} from '@conduitplatform/module-tools';
import {
  ANONYMOUS_DENIED_ERRORS,
  authenticateChecks,
  CAPTCHA_ERRORS,
  changePassword,
  LOGIN_ROUTE_ERRORS,
  SESSION_AUTH_ERRORS,
} from './utils.js';
import { Config } from '../config/index.js';
import { ALT_STRATEGY_AUTH } from '../constants/index.js';
import { errors } from '../errors.js';
import {
  assertDiscoveryAllowed,
  DISCOVERY_RESPONSE_FIELDS,
  discoverWithPassword,
} from './realmDiscovery.js';
import {
  assertGlobalStrategyAvailable,
  loginVerificationOverride,
  realmIdOf,
  realmParam,
  resolveRealmFromCall,
  resolveSignInPrincipal,
} from './realmRequest.js';

export class UsernameHandlers implements IAuthenticationStrategy {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async declareRoutes(routingManager: RoutingManager): Promise<void> {
    const config = ConfigController.getInstance().config;
    const captchaConfig = config.captcha;

    routingManager.route(
      {
        path: '/username',
        action: ConduitRouteActions.POST,
        description: `Login endpoint that can be used to authenticate.
         Tokens are returned according to configuration. With discover (and the realm discovery login enabled) it lists the realms of the accounts that accept the credentials instead, and opens no session.`,
        bodyParams: {
          username: ConduitString.Required,
          password: ConduitString.Required,
          captchaToken: ConduitString.Optional,
          realm: realmParam,
          discover: ConduitBoolean.Optional,
        },
        middlewares:
          captchaConfig.enabled && captchaConfig.routes.login
            ? ['captchaMiddleware']
            : undefined,
        errors: [
          errors.INVALID_CREDENTIALS,
          errors.PASSWORD_AUTH_NOT_AVAILABLE,
          errors.ACCOUNT_NOT_VERIFIED,
          errors.DISCOVERY_REQUEST_INVALID,
          errors.AUTHENTICATION_REQUIRED,
          ...LOGIN_ROUTE_ERRORS,
          ...(captchaConfig.enabled && captchaConfig.routes.login ? CAPTCHA_ERRORS : []),
        ],
        rateLimit: ALT_STRATEGY_AUTH,
      },
      new ConduitRouteReturnDefinition('LoginResponse', {
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
        ...DISCOVERY_RESPONSE_FIELDS,
      }),
      this.authenticate.bind(this),
    );

    routingManager.route(
      {
        path: '/username/change-password',
        action: ConduitRouteActions.POST,
        description: `Changes the user's password (requires sudo access).`,
        bodyParams: {
          newPassword: ConduitString.Required,
        },
        errors: [
          errors.SUDO_REQUIRED,
          ...ANONYMOUS_DENIED_ERRORS,
          ...SESSION_AUTH_ERRORS,
        ],
        middlewares: ['authMiddleware', 'denyAnonymousMiddleware'],
      },
      new ConduitRouteReturnDefinition('ChangePasswordResponse', 'String'),
      changePassword.bind(this),
    );
  }

  async validate(): Promise<boolean> {
    const config: Config = ConfigController.getInstance().config;
    if (config.local.username_auth_enabled) {
      return true;
    } else {
      ConduitGrpcSdk.Logger.log('Username authentication not available');
      return false;
    }
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    ConduitGrpcSdk.Metrics?.increment('login_requests_total');

    const { username, password } = call.request.params;
    const context = call.request.context;

    if (isNil(context)) {
      throw new ModuleError(errors.AUTHENTICATION_REQUIRED);
    }

    assertDiscoveryAllowed({
      discover: call.request.params.discover === true,
      realm: call.request.params.realm,
    });
    if (call.request.params.discover === true) {
      return discoverWithPassword({
        identifier: { username },
        password,
        strategyKey: 'username',
        clientId: context.clientId,
      });
    }

    const clientId = context.clientId;
    const config = ConfigController.getInstance().config;
    const realmCtx = await resolveRealmFromCall(call);
    if (!realmCtx) assertGlobalStrategyAvailable('username');

    const principal = await resolveSignInPrincipal(realmCtx, { username }, 'username', {
      select: '+hashedPassword',
    });
    if (isNil(principal)) {
      throw new ModuleError(errors.INVALID_CREDENTIALS);
    }

    await authenticateChecks(
      password,
      config,
      principal.user,
      loginVerificationOverride(realmCtx, principal, config.local.verification.required),
    );
    return TokenProvider.getInstance().provideUserTokens({
      user: principal.user,
      clientId,
      config,
      realm: realmIdOf(realmCtx),
    });
  }
}
