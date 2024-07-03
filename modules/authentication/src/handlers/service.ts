import { isEmpty, isNil } from 'lodash-es';
import { AuthUtils } from '../utils/index.js';
import {
  ConduitGrpcSdk,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { Service, User } from '../models/index.js';
import { status } from '@grpc/grpc-js';
import { TokenProvider } from './tokenProvider.js';
import { IAuthenticationStrategy } from '../interfaces/index.js';

import { ConfigController, RoutingManager } from '@conduitplatform/module-tools';

export class ServiceHandler implements IAuthenticationStrategy {
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig.service.enabled) {
      ConduitGrpcSdk.Logger.log('Service authentication not available');
      return (this.initialized = false);
    }
    ConduitGrpcSdk.Logger.log('Service authentication is active');
    return (this.initialized = true);
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    ConduitGrpcSdk.Metrics?.increment('login_requests_total');
    const { serviceName, token } = call.request.params;

    const context = call.request.context;
    if (isNil(context) || isEmpty(context))
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');

    const clientId = context.clientId;

    const serviceUser: Service | null = await Service.getInstance().findOne(
      { name: serviceName },
      '+hashedToken',
    );
    if (isNil(serviceUser))
      throw new GrpcError(status.UNAUTHENTICATED, 'Invalid login credentials');
    if (!serviceUser.active)
      throw new GrpcError(status.PERMISSION_DENIED, 'Inactive service user');

    const tokensMatch = await AuthUtils.checkPassword(token, serviceUser.hashedToken);
    if (!tokensMatch)
      throw new GrpcError(status.UNAUTHENTICATED, 'Invalid login credentials');

    const config = ConfigController.getInstance().config;

    ConduitGrpcSdk.Metrics?.increment('logged_in_users_total');
    return TokenProvider.getInstance().provideUserTokens({
      user: serviceUser as unknown as User,
      clientId,
      config,
    });
  }

  declareRoutes(routingManager: RoutingManager): void {}
}
