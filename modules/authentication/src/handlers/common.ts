import { isNil } from 'lodash';
import { ISignTokenOptions } from '../interfaces/ISignTokenOptions';
import { AuthUtils } from '../utils/auth';
import moment from 'moment';
import ConduitGrpcSdk, {
  GrpcError,
  RouterRequest,
} from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';
import { ConfigController } from '../config/Config.controller';

export class CommonHandlers {
  private database: any;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.database = grpcSdk.databaseProvider;
  }

  async renewAuth(call: RouterRequest) {
    const context = JSON.parse(call.request.context);

    const clientId = context.clientId;

    const { refreshToken } = JSON.parse(call.request.params);

    const config = ConfigController.getInstance().config;

    const oldRefreshToken = await this.database.findOne('RefreshToken', {
      token: refreshToken,
      clientId,
    });
    if (isNil(oldRefreshToken)) {
      throw new GrpcError(grpc.status.INVALID_ARGUMENT, 'Invalid parameters');
    }
    if (moment().isAfter(moment(oldRefreshToken.expiresOn))) {
      throw new GrpcError(grpc.status.INVALID_ARGUMENT, 'Token expired');
    }

    await Promise.all(
      AuthUtils.deleteUserTokens(this.grpcSdk, {
        userId: oldRefreshToken.userId,
        clientId,
      })
    );

    const signTokenOptions: ISignTokenOptions = {
      secret: config.jwtSecret,
      expiresIn: config.tokenInvalidationPeriod,
    };

    const newAccessToken = await this.database.create('AccessToken', {
      userId: oldRefreshToken.userId,
      clientId,
      token: AuthUtils.signToken({ id: oldRefreshToken.userId }, signTokenOptions),
      expiresOn: moment().add(config.tokenInvalidationPeriod, 'milliseconds').toDate(),
    });

    const newRefreshToken = await this.database.create('RefreshToken', {
      userId: oldRefreshToken.userId,
      clientId,
      token: AuthUtils.randomToken(),
      expiresOn: moment()
        .add(config.refreshTokenInvalidationPeriod, 'milliseconds')
        .toDate(),
    });

    return {
      result: JSON.stringify({
        accessToken: newAccessToken.token,
        refreshToken: newRefreshToken.token,
      }),
    };
  }

  async logOut(call: RouterRequest) {
    const context = JSON.parse(call.request.context);

    const clientId = context.clientId;
    const user = context.user;

    await Promise.all(
      AuthUtils.deleteUserTokens(this.grpcSdk, {
        userId: user._id,
        clientId,
      })
    );

    return { result: JSON.stringify({ message: 'Logged out' }) };
  }

  async getUser(call: RouterRequest) {
    return { result: JSON.stringify(JSON.parse(call.request.context).user) };
  }

  async deleteUser(call: RouterRequest) {
    const context = JSON.parse(call.request.context);

    const user = context.user;
    await this.database.deleteOne('User', { _id: user._id });

    Promise.all(
      AuthUtils.deleteUserTokens(this.grpcSdk, {
        userId: user._id,
      })
    ).catch((e: any) => console.log('Failed to delete all access tokens'));
    return { result: 'done' };
  }
}
