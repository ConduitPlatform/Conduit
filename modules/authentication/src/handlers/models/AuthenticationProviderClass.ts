import ConduitGrpcSdk, {
  GrpcError, ParsedRouterRequest, UnparsedRouterResponse,
} from '@conduitplatform/conduit-grpc-sdk';
import { Payload } from '../interfaces/Payload';
import { isEmpty, isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { User } from '../../models';
import { AuthUtils } from '../../utils/auth';
import moment = require('moment');
import { ConnectionCredentials } from '../interfaces/ConnectionCredentials';
import { ConfigController } from '../../config/Config.controller';

export abstract class AuthenticationProviderClass<T extends Payload> {
  private providerName: string;
  grpcSdk: ConduitGrpcSdk;

  constructor(grpcSdk: ConduitGrpcSdk, providerName: string) {
    this.providerName = providerName;
    this.grpcSdk = grpcSdk;
  }

  abstract async validate(): Promise<Boolean>;

  abstract async connectWithProvider(options: ConnectionCredentials): Promise<any>;

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const context = call.request.context;
    if (isNil(context) || isEmpty(context))
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');

    let options: ConnectionCredentials = {
      id_token: call.request.params.id_token,
      access_token: call.request.params.access_token,
      expires_in: call.request.params.expires_in,
      context: call.request.context,
    };
    const config = ConfigController.getInstance().config;
    let { payload, user } = await this.connectWithProvider(options);
    if (!isNil(user)) {
      if (!user.active) throw new GrpcError(status.PERMISSION_DENIED, 'Inactive user');
      if (!config[this.providerName].accountLinking) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'User with this email already exists',
        );
      }
      if (isNil(user[this.providerName])) {
        user[this.providerName] = payload;
        // TODO look into this again, as the email the user has registered will still not be verified
        if (!user.isVerified) user.isVerified = true;
        user = await User.getInstance().findByIdAndUpdate(user._id, user);
      }
    } else {
      user = await User.getInstance().create({
        email: payload.email,
        [this.providerName]: { payload },
        isVerified: true,
      });
    }
    const [accessToken, refreshToken] = await AuthUtils.createUserTokensAsPromise(
      this.grpcSdk,
      {
        userId: user!._id,
        clientId: config[this.providerName].clientId!,
        config: config,
      },
    );
    let retObject: any = {
      userId: user!._id.toString(),
      accessToken: (accessToken as any).token,
      refreshToken: (refreshToken as any).token,
    };
    return retObject;
  }
}