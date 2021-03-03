import request, { OptionsWithUrl } from 'request-promise';
import { isEmpty, isNil } from 'lodash';
import ConduitGrpcSdk, { ConduitError } from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';
import { ConfigController } from '../config/Config.controller';
import { AuthUtils } from '../utils/auth';

export class FacebookHandlers {
  private database: any;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.database = this.grpcSdk.databaseProvider;
    this.validate()
      .then((r) => {
        console.log('Facebook is active');
      })
      .catch((err) => {
        console.log('Facebook not active');
      });
  }

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;

    if (!authConfig.facebook.enabled) {
      throw ConduitError.forbidden('Facebook auth is deactivated');
    }
    if (!authConfig.facebook.clientId) {
      throw ConduitError.forbidden('Cannot enable facebook auth due to missing clientId');
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

    const { access_token } = JSON.parse(call.request.params);

    let errorMessage = null;

    const config = ConfigController.getInstance().config;

    const context = JSON.parse(call.request.context);
    if (isNil(context) || isEmpty(context))
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'No headers provided',
      });

    const facebookOptions: OptionsWithUrl = {
      method: 'GET',
      url: 'https://graph.facebook.com/v5.0/me',
      qs: {
        access_token,
        fields: 'id,email',
      },
      json: true,
    };

    const facebookResponse = await request(facebookOptions).catch(
      (e: any) => (errorMessage = e.message)
    );
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (isNil(facebookResponse.email) || isNil(facebookResponse.id)) {
      return callback({
        code: grpc.status.UNAUTHENTICATED,
        message: 'Authentication with facebook failed',
      });
    }

    let user = await this.database
      .findOne('User', { email: facebookResponse.email })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (!isNil(user)) {
      if (!user.active)
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'Inactive user',
        });
      if (!config.facebook.accountLinking) {
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'User with this email already exists',
        });
      }
      if (isNil(user.facebook)) {
        user.facebook = {
          id: facebookResponse.id,
        };
        // TODO look into this again, as the email the user has registered will still not be verified
        if (!user.isVerified) user.isVerified = true;
        user = await this.database
          .findByIdAndUpdate('User', user)
          .catch((e: any) => (errorMessage = e.message));
        if (!isNil(errorMessage))
          return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      }
    } else {
      user = await this.database
        .create('User', {
          email: facebookResponse.email,
          facebook: {
            id: facebookResponse.id,
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
