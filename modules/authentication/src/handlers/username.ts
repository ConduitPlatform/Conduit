import { isNil } from 'lodash-es';
import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { User } from '../models/index.js';
import { status } from '@grpc/grpc-js';
import { IAuthenticationStrategy } from '../interfaces/index.js';
import { TokenProvider } from './tokenProvider.js';
import {
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { authenticateChecks, changePassword } from './utils.js';
import { Config } from '../config/index.js';

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
         Tokens are returned according to configuration.`,
        bodyParams: {
          username: ConduitString.Required,
          password: ConduitString.Required,
          captchaToken: ConduitString.Optional,
        },
        middlewares:
          captchaConfig.enabled && captchaConfig.routes.login
            ? ['captchaMiddleware']
            : undefined,
      },
      new ConduitRouteReturnDefinition('LoginResponse', {
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
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

    const clientId = context.clientId;
    const config = ConfigController.getInstance().config;

    const user: User | null = await User.getInstance().findOne(
      { username },
      '+hashedPassword',
    );

    if (isNil(user)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Invalid login credentials');
    }

    await authenticateChecks(password, config, user);

    ConduitGrpcSdk.Metrics?.increment('logged_in_users_total');

    return TokenProvider.getInstance().provideUserTokens({
      user,
      clientId,
      config,
    });
  }
}
