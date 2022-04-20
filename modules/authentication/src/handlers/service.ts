import { isEmpty, isNil } from 'lodash';
import { AuthUtils } from '../utils/auth';
import ConduitGrpcSdk, {
  ConduitError,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
  ConfigController,
} from '@conduitplatform/grpc-sdk';
import { Service } from '../models';
import { status } from '@grpc/grpc-js';

export class ServiceHandler {
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
  }

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig.service.enabled) {
      console.error('Service not active');
      throw ConduitError.forbidden('Service auth is deactivated');
    }
    console.log('Service is active');
    this.initialized = true;
    return true;
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
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

    const [accessToken, refreshToken] = await AuthUtils.createUserTokensAsPromise(
      this.grpcSdk,
      {
        userId: serviceUser._id,
        clientId: context.clientId,
        config,
      },
    );
    if (config.set_cookies.enabled) {
      return AuthUtils.returnCookies((accessToken as any).token, (refreshToken as any).token);
    }
    return {
      serviceId: serviceUser._id.toString(),
      accessToken: (accessToken as any).token,
      refreshToken: (refreshToken as any).token,
    };
  }
}
