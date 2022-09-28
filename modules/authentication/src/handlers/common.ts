import { isNil } from 'lodash';
import moment from 'moment';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  ConfigController,
  GrpcError,
  ParsedRouterRequest,
  RoutingManager,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { RefreshToken, User } from '../models';
import { IAuthenticationStrategy } from '../interfaces/AuthenticationStrategy';
import { Config } from '../config';
import { TokenProvider } from './tokenProvider';

export class CommonHandlers implements IAuthenticationStrategy {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async renewAuth(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    const clientId = context.clientId;
    const { refreshToken } = call.request.params;
    const config = ConfigController.getInstance().config;

    const oldRefreshToken: RefreshToken | null = await RefreshToken.getInstance().findOne(
      {
        token: refreshToken,
        clientId,
      },
      undefined,
      ['user'],
    );
    if (isNil(oldRefreshToken)) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid parameters');
    }
    if (moment().isAfter(moment(oldRefreshToken.expiresOn))) {
      throw new GrpcError(status.INVALID_ARGUMENT, 'Token expired');
    }

    // delete the old refresh token
    await RefreshToken.getInstance().deleteOne({
      token: refreshToken,
      clientId,
    });

    const user = await User.getInstance().findOne({
      _id: (oldRefreshToken.user as User)._id,
    });
    if (!user) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Invalid user');
    }
    return TokenProvider.getInstance()!.provideUserTokens({
      user,
      clientId,
      config,
      twoFaPass: true,
      isRefresh: true,
    });
  }

  async logOut(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    const clientId = context.clientId;
    const user = context.user;
    const config: Config = ConfigController.getInstance().config;
    const authToken = call.request.headers.authorization;
    const clientConfig = config.clients;
    ConduitGrpcSdk.Metrics?.decrement('logged_in_users_total');
    await TokenProvider.getInstance()!.logOutClientOperations(
      this.grpcSdk,
      clientConfig,
      authToken,
      clientId,
      user._id,
    );
    let removeCookies = [];
    if (config.refreshTokens.enabled && config.refreshTokens.setCookie) {
      removeCookies.push({
        name: 'refreshToken',
        options: { ...config.cookieOptions, ...config.refreshTokens.cookieOptions },
      });
    }
    if (config.refreshTokens.enabled && config.refreshTokens.setCookie) {
      removeCookies.push({
        name: 'accessToken',
        options: { ...config.cookieOptions, ...config.accessTokens.cookieOptions },
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
    const context = call.request.context;

    const user = context.user;
    await User.getInstance().deleteOne({ _id: user._id });

    return this.logOut(call);
  }

  declareRoutes(routingManager: RoutingManager, config: Config): void {
    routingManager.route(
      {
        path: '/user',
        description: `Returns the authenticated user.`,
        action: ConduitRouteActions.GET,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition(User.name),
      this.getUser.bind(this),
    );
    routingManager.route(
      {
        path: '/user',
        description: `Deletes the authenticated user.`,
        action: ConduitRouteActions.DELETE,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('DeleteUserResponse', 'String'),
      this.deleteUser.bind(this),
    );
    if (config.refreshTokens.enabled) {
      routingManager.route(
        {
          path: '/renew',
          action: ConduitRouteActions.POST,
          description: `Renews the access and refresh tokens 
              when provided with a valid refresh token.`,
          bodyParams: {
            refreshToken: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('RenewAuthenticationResponse', {
          accessToken: ConduitString.Required,
          refreshToken: ConduitString.Required,
        }),
        this.renewAuth.bind(this),
      );
    }

    routingManager.route(
      {
        path: '/logout',
        action: ConduitRouteActions.POST,
        description: `Logs out authenticated user.`,
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
