import { isEmpty, isNil } from 'lodash';
import { ISignTokenOptions } from '../../interfaces/ISignTokenOptions';
import { AuthUtils } from '../../utils/auth';
import moment from 'moment';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';

export class CommonHandlers {
  private database: any;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.initDbAndEmail(grpcSdk);
  }

  private async initDbAndEmail(grpcSdk: ConduitGrpcSdk) {
    await grpcSdk.waitForExistence('database-provider');
    this.database = grpcSdk.databaseProvider;
  }

  async renewAuth(call: any, callback: any) {
    const context = JSON.parse(call.request.context);

    const clientId = context.clientId;

    const { refreshToken } = JSON.parse(call.request.params);
    if (isNil(refreshToken)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Invalid parameters',
      });
    }

    let errorMessage = null;
    const config = await this.grpcSdk.config
      .get('authentication')
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    const oldRefreshToken = await this.database
      .findOne('RefreshToken', {
        token: refreshToken,
        clientId,
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    if (isNil(oldRefreshToken)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Invalid parameters',
      });
    }
    if (moment().isAfter(moment(oldRefreshToken.expiresOn))) {
      return callback({ code: grpc.status.INVALID_ARGUMENT, message: 'Token expired' });
    }

    // delete the old tokens before generating new ones
    const accessTokenPromise = this.database.deleteMany('AccessToken', {
      userId: oldRefreshToken.userId,
      clientId,
    });
    const refreshTokenPromise = this.database.deleteMany('RefreshToken', {
      userId: oldRefreshToken.userId,
      clientId,
    });

    await Promise.all([accessTokenPromise, refreshTokenPromise]).catch(
      (e: any) => (errorMessage = e.message)
    );
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    const signTokenOptions: ISignTokenOptions = {
      secret: config.jwtSecret,
      expiresIn: config.tokenInvalidationPeriod,
    };

    const newAccessToken = await this.database
      .create('AccessToken', {
        userId: oldRefreshToken.userId,
        clientId,
        token: AuthUtils.signToken({ id: oldRefreshToken.userId }, signTokenOptions),
        expiresOn: moment().add(config.tokenInvalidationPeriod, 'milliseconds').toDate(),
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    const newRefreshToken = await this.database
      .create('RefreshToken', {
        userId: oldRefreshToken.userId,
        clientId,
        token: AuthUtils.randomToken(),
        expiresOn: moment()
          .add(config.refreshTokenInvalidationPeriod, 'milliseconds')
          .toDate(),
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    return callback(null, {
      result: JSON.stringify({
        accessToken: newAccessToken.token,
        refreshToken: newRefreshToken.token,
      }),
    });
  }

  async logOut(call: any, callback: any) {
    const context = JSON.parse(call.request.context);

    const clientId = context.clientId;
    const user = context.user;

    const accessTokenPromise = this.database.deleteMany('AccessToken', {
      userId: user._id,
      clientId,
    });
    const refreshTokenPromise = this.database.deleteMany('RefreshToken', {
      userId: user._id,
      clientId,
    });

    let errorMessage = null;
    await Promise.all([accessTokenPromise, refreshTokenPromise]).catch(
      (e: any) => (errorMessage = e.message)
    );
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    return callback(null, { result: JSON.stringify({ message: 'Logged out' }) });
  }

  async getUser(call: any, callback: any) {
    const context = JSON.parse(call.request.context);

    const user = context.user;

    return callback(null, { result: JSON.stringify(user) });
  }

  async deleteUser(call: any, callback: any) {
    const context = JSON.parse(call.request.context);

    const user = context.user;
    let errorMessage = null;
    await this.database
      .deleteOne('User', { _id: user._id })
      .catch((e: any) => (errorMessage = e.message));

    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    callback(null, { result: 'done' });

    const accessTokenPromise = this.database.deleteMany('AccessToken', {
      userId: user._id,
    });
    const refreshTokenPromise = this.database.deleteMany('RefreshToken', {
      userId: user._id,
    });
    await Promise.all([accessTokenPromise, refreshTokenPromise]).catch(
      (e: any) => (errorMessage = e.message)
    );
    if (!isNil(errorMessage)) console.log('Failed to delete all access tokens');
  }
}
