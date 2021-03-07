import { OAuth2Client } from 'google-auth-library';
import { isEmpty, isNil } from 'lodash';
import ConduitGrpcSdk, { ConduitError } from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';
import { ConfigController } from '../config/Config.controller';
import { AuthUtils } from '../utils/auth';
import moment = require('moment');

export class GoogleHandlers {
  private readonly client: OAuth2Client;
  private database: any;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.client = new OAuth2Client();
    this.database = this.grpcSdk.databaseProvider;
    this.validate()
      .then(() => {
        console.log('Google is active');
      })
      .catch((err) => {
        console.log('Google not active');
      });
  }

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig.google.enabled) {
      throw ConduitError.forbidden('Google auth is deactivated');
    }
    if (!authConfig.google.clientId) {
      throw ConduitError.forbidden('Cannot enable google auth due to missing clientId');
    }
    this.initialized = true;
    return true;
  }

  async authenticate(call: any, callback: any) {
    if (!this.initialized)
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'Requested resource not found',
      });
    const { id_token, access_token, expires_in } = JSON.parse(call.request.params);

    let errorMessage = null;

    const config = ConfigController.getInstance().config;

    const context = JSON.parse(call.request.context);
    if (isNil(context) || isEmpty(context))
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'No headers provided',
      });

    const ticket = await this.client
      .verifyIdToken({
        idToken: id_token,
        audience: config.google.clientId,
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    const payload = ticket.getPayload();
    if (isNil(payload)) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'Received invalid response from the Google API',
      });
    }
    if (!payload.email_verified) {
      return callback({ code: grpc.status.UNAUTHENTICATED, message: 'Unauthorized' });
    }

    let user = await this.database
      .findOne('User', { email: payload.email })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (!isNil(user)) {
      if (!user.active)
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'Inactive user',
        });
      if (!config.google.accountLinking) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'User with this email already exists',
        });
      }
      if (isNil(user.google)) {
        user.google = {
          id: payload.sub,
          token: access_token,
          tokenExpires: moment().add(expires_in as number, 'milliseconds'),
        };
        if (!user.isVerified) user.isVerified = true;
        user = await this.database
          .findByIdAndUpdate('User', user._id, user)
          .catch((e: any) => (errorMessage = e.message));
        if (!isNil(errorMessage))
          return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      }
    } else {
      user = await this.database
        .create('User', {
          email: payload.email,
          google: {
            id: payload.sub,
            token: access_token,
            tokenExpires: moment().add(expires_in).format(),
          },
          isVerified: true,
        })
        .catch((e: any) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }

    const [accessToken, refreshToken] = await AuthUtils.createUserTokensAsPromise(
      this.grpcSdk,
      {
        userId: user._id,
        clientId: context.clientId,
        config,
      }
    ).catch((e) => (errorMessage = e));

    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    return callback(null, {
      result: JSON.stringify({
        userId: user._id.toString(),
        accessToken: accessToken.token,
        refreshToken: refreshToken.token,
      }),
    });
  }
}
