import ConduitGrpcSdk, {
  ConduitError,
  GrpcError,
  ParsedRouterRequest,
  RouterRequest,
  UnparsedRouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';
import { isNil } from 'lodash';
import axios from 'axios';
import moment from 'moment';
import { ConfigController } from '../config/Config.controller';
import { AuthUtils } from '../utils/auth';
import { User } from '../models';

export class TwitchHandlers {
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig.twitch.enabled) {
      console.log('twitch not active');
      throw ConduitError.forbidden('Twitch auth is deactivated');
    }
    if (
      !authConfig.twitch ||
      !authConfig.twitch.clientId ||
      !authConfig.twitch.clientSecret
    ) {
      console.log('twitch not active');
      throw ConduitError.forbidden(
        'Cannot enable twitch auth due to missing clientId or client secret'
      );
    }
    console.log('twitch is active');
    this.initialized = true;
    return true;
  }

  async beginAuth(call: RouterRequest) {
    const config = ConfigController.getInstance().config;

    let serverConfig = await this.grpcSdk.config.getServerConfig();
    let redirect = serverConfig.url + '/hook/authentication/twitch';
    const context = JSON.parse(call.request.context);
    const clientId = context.clientId;
    let originalUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${config.twitch.clientId}&redirect_uri=${redirect}&response_type=code&scope=user:read:email&state=${clientId}`;
    return {
      result: originalUrl,
    };
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = call.request.params;
    const code = params.code;

    const config = ConfigController.getInstance().config;

    let serverConfig = await this.grpcSdk.config.getServerConfig();
    let url = serverConfig.url;

    let twitch_access_token = undefined;
    let expires_in = undefined;
    let id = undefined;
    let email = undefined;
    let profile_image_url = undefined;

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

    let user: User | null = await User.getInstance().findOne({ 'twitch.id': id });
    if (isNil(user) && !isNil(email)) {
      user = await User.getInstance().findOne({ email: email });
    }
    if (isNil(user)) {
      user = await User.getInstance().create({
        email,
        twitch: {
          id,
          token: twitch_access_token,
          tokenExpires: moment().add(expires_in).format(),
          profile_image_url,
        },
        isVerified: true,
      });
    } else {
      if (!user.active)
        throw new GrpcError(grpc.status.PERMISSION_DENIED, 'Inactive user');
      if (!user.twitch) {
        user = await User.getInstance().findByIdAndUpdate(
          user._id,
          {
            twitch: {
              id,
              token: twitch_access_token,
              tokenExpires: moment().add(expires_in).format(),
              profile_image_url,
            },
          },
          true
        );
      }
    }

    let clientId = params.state;

    const [accessToken, refreshToken] = await AuthUtils.createUserTokensAsPromise(
      this.grpcSdk,
      {
        userId: user!._id,
        clientId,
        config,
      }
    );
    return {
      redirect:
        config.twitch.redirect_uri +
        '?accessToken=' +
        (accessToken as any).token +
        '&refreshToken=' +
        (refreshToken as any).token,
      result: {
        userId: user!._id.toString(),
        accessToken: (accessToken as any).token,
        refreshToken: (refreshToken as any).token,
      },
    };
  }
}
