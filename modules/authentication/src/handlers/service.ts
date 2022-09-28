import { isEmpty, isNil } from 'lodash';
import { AuthUtils } from '../utils/auth';
import ConduitGrpcSdk, {
  ConfigController,
  GrpcError,
  ParsedRouterRequest,
  RoutingManager,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { Service, User } from '../models';
import { status } from '@grpc/grpc-js';
import { IAuthenticationStrategy } from '../interfaces/AuthenticationStrategy';
import { TokenProvider } from './tokenProvider';

export class ServiceHandler implements IAuthenticationStrategy {
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig.service.enabled) {
      ConduitGrpcSdk.Logger.error('Service not active');
      return (this.initialized = false);
    }
    ConduitGrpcSdk.Logger.log('Service is active');
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

    await Promise.all(
      AuthUtils.deleteUserTokens(this.grpcSdk, {
        userId: serviceUser._id,
        clientId,
      }),
    );
    ConduitGrpcSdk.Metrics?.increment('logged_in_users_total');
    return TokenProvider.getInstance()!.provideUserTokens({
      user: serviceUser as unknown as User,
      clientId,
      config,
    });
  }

  declareRoutes(routingManager: RoutingManager): void {}
}
