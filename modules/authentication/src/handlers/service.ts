import { isEmpty, isNil } from 'lodash';
import { AuthUtils } from '../utils/auth';
import ConduitGrpcSdk, {
  ConduitError,
  GrpcError,
  RouterRequest,
} from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';
import { ConfigController } from '../config/Config.controller';

export class ServiceHandler {
  private database: any;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.database = this.grpcSdk.databaseProvider;
  }

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig.service.enabled) {
      console.error('Service not active');
      throw ConduitError.forbidden('Service auth is deactivated');
    }
    console.error('Service is active');
    this.initialized = true;
    return true;
  }

  async authenticate(call: RouterRequest) {
    if (!this.initialized)
      throw new GrpcError(grpc.status.NOT_FOUND, 'Requested resource not found');
    const { serviceName, token } = JSON.parse(call.request.params);

    const context = JSON.parse(call.request.context);
    if (isNil(context) || isEmpty(context))
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'No headers provided');

    const clientId = context.clientId;

    const serviceUser = await this.database.findOne(
      'Service',
      { name: serviceName },
      '+hashedToken'
    );
    if (isNil(serviceUser))
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'Invalid login credentials');
    if (!serviceUser.active)
      throw new GrpcError(grpc.status.PERMISSION_DENIED, 'Inactive service user');

    const tokensMatch = await AuthUtils.checkPassword(token, serviceUser.hashedToken);
    if (!tokensMatch)
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'Invalid login credentials');

    const config = ConfigController.getInstance().config;

    await Promise.all(
      AuthUtils.deleteUserTokens(this.grpcSdk, {
        userId: serviceUser._id,
        clientId,
      })
    );

    const [accessToken, refreshToken] = await AuthUtils.createUserTokensAsPromise(
      this.grpcSdk,
      {
        userId: serviceUser._id,
        clientId: context.clientId,
        config,
      }
    );

    return {
      result: JSON.stringify({
        serviceId: serviceUser._id.toString(),
        accessToken: (accessToken as any).token,
        refreshToken: (refreshToken as any).token,
      }),
    };
  }
}
