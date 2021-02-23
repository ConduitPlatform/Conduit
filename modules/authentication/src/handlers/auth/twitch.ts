import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { ConduitError } from '@quintessential-sft/conduit-grpc-sdk';
import { AuthUtils } from '../../utils/auth';
import { ISignTokenOptions } from '../../interfaces/ISignTokenOptions';
import grpc from 'grpc';
import { isNil } from 'lodash';
import axios from 'axios';
import moment from 'moment';

export class TwitchHandlers {
  private database: any;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.validate()
      .then((r) => {
        return this.initDbAndEmail();
      })
      .catch((err) => {
        console.log('twitch not active');
      });
  }

  async validate(): Promise<Boolean> {
    return this.grpcSdk.config
      .get('authentication')
      .then((authConfig: any) => {
        if (!authConfig.twitch.enabled) {
          throw ConduitError.forbidden('Twitch auth is deactivated');
        }
        if (
          !authConfig.twitch ||
          !authConfig.twitch.clientId ||
          !authConfig.twitch.clientSecret
        ) {
          throw ConduitError.forbidden(
            'Cannot enable twitch auth due to missing clientId or client secret'
          );
        }
      })
      .then(() => {
        if (!this.initialized) {
          return this.initDbAndEmail();
        }
      })
      .then((r) => {
        return true;
      })
      .catch((err: Error) => {
        // De-initialize the provider if the config is now invalid
        this.initialized = false;
        throw err;
      });
  }

  private async initDbAndEmail() {
    await this.grpcSdk.waitForExistence('database-provider');
    this.database = this.grpcSdk.databaseProvider;
    this.initialized = true;
  }

  async authenticate(call: any, callback: any) {
    const code = JSON.parse(call.request.params).code;
    if (isNil(code))
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Invalid parameters',
      });

    let errorMessage = null;

    const config = await this.grpcSdk.config
      .get('authentication')
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    let serverConfig = await this.grpcSdk.config
      .getServerConfig()
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    let url = serverConfig.url;

    let twitch_access_token = undefined;
    let expires_in = undefined;
    let id = undefined;
    let email = undefined;
    let profile_image_url = undefined;

    try {
      const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
          client_id: config.twitch.clientId,
          client_secret: config.twitch.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: url + '/hook/authentication/twitch',
        },
      });

      twitch_access_token = response.data.access_token;
      expires_in = response.data.expires_in;

      const response2 = await axios.get('https://api.twitch.tv/helix/users', {
        headers: {
          Authorization: `Bearer ${twitch_access_token}`,
          'Client-Id': config.twitch.clientId,
        },
      });

      id = response2.data.data[0].id;
      email = response2.data.data[0].email;
      profile_image_url = response2.data.data[0].profile_image_url;
    } catch (e) {
      errorMessage = e.message;
    }
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    let user = await this.database
      .findOne('User', { 'twitch.id': id })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    if (isNil(user) && !isNil(email)) {
      user = await this.database
        .findOne('User', { email: email })
        .catch((e: any) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    }
    if (isNil(user)) {
      user = await this.database
        .create('User', {
          email,
          twitch: {
            id,
            token: twitch_access_token,
            tokenExpires: moment().add(expires_in).format(),
            profile_image_url,
          },
          isVerified: true,
        })
        .catch((e: any) => (errorMessage = e.message));
      if (!isNil(errorMessage))
        return callback({ code: grpc.status.INTERNAL, message: errorMessage });
    } else {
      if (!user.active)
        return callback({
          code: grpc.status.PERMISSION_DENIED,
          message: 'Inactive user',
        });
      if (!user.twitch) {
        user = await this.database
          .findByIdAndUpdate('User', user._id, {
            $set: {
              ['twitch']: {
                id,
                token: twitch_access_token,
                tokenExpires: moment().add(expires_in).format(),
                profile_image_url,
              },
            },
          })
          .catch((e: any) => (errorMessage = e.message));
        if (!isNil(errorMessage))
          return callback({ code: grpc.status.INTERNAL, message: errorMessage });
      }
    }

    const signTokenOptions: ISignTokenOptions = {
      secret: config.jwtSecret,
      expiresIn: config.tokenInvalidationPeriod,
    };

    let clientId = AuthUtils.randomToken(); // TODO find a way to pass the client id

    const accessToken = await this.database
      .create('AccessToken', {
        userId: user._id,
        clientId,
        token: AuthUtils.signToken({ id: user._id }, signTokenOptions),
        expiresOn: moment()
          .add(config.tokenInvalidationPeriod as number, 'milliseconds')
          .toDate(),
      })
      .catch((e: any) => (errorMessage = e.message));
    if (!isNil(errorMessage))
      return callback({ code: grpc.status.INTERNAL, message: errorMessage });

    const refreshToken = await this.database
      .create('RefreshToken', {
        userId: user._id,
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
      redirect:
        config.twitch.redirect_uri +
        '?accessToken=' +
        accessToken.token +
        '&refreshToken=' +
        refreshToken.token,
      result: JSON.stringify({
        userId: user._id.toString(),
        accessToken: accessToken.token,
        refreshToken: refreshToken.token,
      }),
    });
  }
}
