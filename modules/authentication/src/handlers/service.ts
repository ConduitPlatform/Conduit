import { isEmpty, isNil } from 'lodash';
import { AuthUtils } from '../utils/auth';
import ConduitGrpcSdk, { ConduitError, RouterResponse, RouterRequest } from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';
import { ConfigController } from '../config/Config.controller';

export class ServiceHandler {
  private database: any;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.database = this.grpcSdk.databaseProvider;
    this.validate()
      .then((r: any) => {
        console.error('Service is active');
      })
      .catch((err: any) => {
        console.error('Service not active');
      });
  }

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig.service.enabled) {
      throw ConduitError.forbidden('Service auth is deactivated');
    }
    this.initialized = true;
    return true;
  }

  async authenticate(call: RouterRequest, callback: RouterResponse) {
    if (!this.initialized)
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested resource not found',
      });
    const { serviceName, token } = JSON.parse(call.request.params);

    if (isNil(serviceName) || isNil(token))
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Service name and password required',
      });

    let errorMessage = null;

    const context = JSON.parse(call.request.context);
    if (isNil(context) || isEmpty(context))
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'No headers provided',
      });

    const clientId = context.clientId;

    const serviceUser = await this.database
      .findOne('Service', { name: serviceName }, '+hashedToken')
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (isNil(serviceUser))
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'Invalid login credentials',
      });
    if (!serviceUser.active)
      return callback({
        code: grpc.status.PERMISSION_DENIED,
        message: 'Inactive service user',
      });

    const tokensMatch = await AuthUtils.checkPassword(
      token,
      serviceUser.hashedToken
    ).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (!tokensMatch)
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'Invalid login credentials',
      });

    const config = ConfigController.getInstance().config;

    await Promise.all(
      AuthUtils.deleteUserTokens(this.grpcSdk, {
        userId: serviceUser._id,
        clientId,
      })
    ).catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    const [accessToken, refreshToken] = await AuthUtils.createUserTokensAsPromise(
      this.grpcSdk,
      {
        userId: serviceUser._id,
        clientId: context.clientId,
        config,
      }
    ).catch((e) => (errorMessage = e));

    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    return callback(null, {
      result: JSON.stringify({
        serviceId: serviceUser._id.toString(),
        accessToken: accessToken.token,
        refreshToken: refreshToken.token,
      }),
    });
  }
}
