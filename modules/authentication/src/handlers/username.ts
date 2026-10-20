import { isNil } from 'lodash-es';
import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { IAuthenticationStrategy } from '../interfaces/index.js';
import { TokenProvider } from './tokenProvider.js';
import {
  ConduitBoolean,
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { authenticateChecks, changePassword } from './utils.js';
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
          errors.REALM_NOT_FOUND,
          errors.REALMS_DISABLED,
          errors.STRATEGY_NOT_AVAILABLE_FOR_REALM,
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
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');
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
      throw new GrpcError(status.UNAUTHENTICATED, 'Invalid login credentials');
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
