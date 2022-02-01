import ConduitGrpcSdk, {
  GrpcError,
} from '@conduitplatform/conduit-grpc-sdk';
import { Payload } from '../interfaces/Payload';
import { isNil } from 'lodash';
import { status } from '@grpc/grpc-js';
import { User } from '../../models';
import { AuthUtils } from '../../utils/auth';
import moment = require('moment');

export abstract class AuthenticationProviderClass {
  private providerName: string;
  grpcSdk: ConduitGrpcSdk;

  constructor(grpcSdk: ConduitGrpcSdk, providerName: string) {
    this.providerName = providerName;
    this.grpcSdk = grpcSdk;
  }

  abstract async validate(): Promise<Boolean>;

  async createTokens(payload: Payload): Promise<any> {

    if (!isNil(payload.user)) {
      if (!payload.user.active) throw new GrpcError(status.PERMISSION_DENIED, 'Inactive user');
      if (!payload.config[this.providerName].accountLinking) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'User with this email already exists',
        );
      }
      if (isNil(payload.user[this.providerName])) {
        payload.user[this.providerName] = {
          id: payload.data.id as string,
          token: payload.data.token,
          tokenExpires: moment()
            .add(payload.data.tokenExpires! as number, 'milliseconds')
            .toDate(),
        };
        // TODO look into this again, as the email the user has registered will still not be verified
        if (!payload.user.isVerified) payload.user.isVerified = true;
        payload.user = await User.getInstance().findByIdAndUpdate(payload.user._id, payload.user);
      }
    } else {
      payload.user = await User.getInstance().create({
        email: payload.email,
        [this.providerName]: {
          id: payload.data.id,
          token: payload.data.token,
          tokenExpires: moment().add(payload.data.tokenExpires!).format(),
        },
        isVerified: true,
      });
    }

    const [accessToken, refreshToken] = await AuthUtils.createUserTokensAsPromise(
      this.grpcSdk,
      {
        userId: payload.user!._id,
        clientId: payload.clientId!,
        config: payload.config,
      },
    );

    return {
      userId: payload.user!._id.toString(),
      accessToken: (accessToken as any).token,
      refreshToken: (refreshToken as any).token,
    };
  }


}