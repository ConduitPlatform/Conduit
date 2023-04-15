import { isNil } from 'lodash';
import moment from 'moment';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { RefreshToken, User } from '../models';
import { IAuthenticationStrategy } from '../interfaces';
import { Config } from '../config';
import { TokenProvider } from './tokenProvider';
import {
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';

export class CommonHandlers implements IAuthenticationStrategy {
  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async renewAuth(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const { refreshToken, clientId } = call.request.context;
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
    if (!oldRefreshToken.user) {
      throw new GrpcError(status.PERMISSION_DENIED, 'Invalid user');
    }

    // delete the old refresh token
    await RefreshToken.getInstance().deleteOne({ _id: oldRefreshToken._id });

    return TokenProvider.getInstance().provideUserTokens({
      user: oldRefreshToken.user as User,
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
    await TokenProvider.getInstance().logOutClientOperations(
      this.grpcSdk,
      clientConfig,
      authToken!,
      clientId,
      user._id,
    );
    const removeCookies = [];
    if (config.refreshTokens.enabled && config.refreshTokens.setCookie) {
      removeCookies.push({
        name: 'refreshToken',
        options: config.refreshTokens.cookieOptions,
      });
    }
    if (config.refreshTokens.enabled && config.refreshTokens.setCookie) {
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
      throw new GrpcError(
        status.PERMISSION_DENIED,
        'Re-login required to enter sudo mode',
      );
    }
    await User.getInstance().deleteOne({ _id: user._id });
    await this.grpcSdk.authorization!.deleteAllRelations({
      resource: 'User:' + user._id,
    });
    await this.grpcSdk.authorization!.deleteAllRelations({
      subject: 'User:' + user._id,
    });

    return this.logOut(call);
  }

  declareRoutes(routingManager: RoutingManager): void {
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
        description: 'Deletes the authenticated user.',
        action: ConduitRouteActions.DELETE,
        middlewares: ['authMiddleware'],
      },
      new ConduitRouteReturnDefinition('DeleteUserResponse', 'String'),
      this.deleteUser.bind(this),
    );
    const config = ConfigController.getInstance().config;
    if (config.refreshTokens.enabled) {
      routingManager.route(
        {
          path: '/renew',
          action: ConduitRouteActions.POST,
          description:
            'Renews the access and refresh tokens. ' +
            `Requires a valid refresh token provided in Authorization header/cookie. Format 'Bearer TOKEN'`,
          middlewares: ['authMiddleware'],
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
        description: 'Logs out authenticated user.',
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
