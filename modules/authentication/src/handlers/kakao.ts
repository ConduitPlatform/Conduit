import ConduitGrpcSdk, {
  ConduitError,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { isNil } from 'lodash';
import axios from 'axios';
import querystring from 'querystring';
import moment from 'moment';
import { ConfigController } from '../config/Config.controller';
import { AuthUtils } from '../utils/auth';
import { User } from '../models';
import { status } from '@grpc/grpc-js';

export class KakaoHandlers {
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig.kakao.enabled) {
      console.log('Kakao not active');
      throw ConduitError.forbidden('Kakao auth is deactivated');
    }
    if (!authConfig.kakao || !authConfig.kakao.clientId) {
      console.log('Kakao not active');
      throw ConduitError.forbidden('Cannot enable kakao auth due to missing clientId');
    }
    console.log('Kakao is active');
    this.initialized = true;
    return true;
  }

  async beginAuth(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const config = ConfigController.getInstance().config;

    let serverConfig = await this.grpcSdk.config.getServerConfig();
    let redirect = serverConfig.url + '/hook/authentication/kakao';
    const context = call.request.context;
    const clientId = context.clientId;
    return `https://kauth.kakao.com/oauth/authorize?client_id=${config.kakao.clientId}&redirect_uri=${redirect}&response_type=code&state=${clientId}`;
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    const params = call.request.params;
    const code = params.code;

    const config = ConfigController.getInstance().config;

    let serverConfig = await this.grpcSdk.config.getServerConfig();
    let url = serverConfig.url;

    let kakao_access_token = undefined;
    let expires_in = undefined;
    let userInfo = undefined;

    const response = await axios.post(
      'https://kauth.kakao.com/oauth/token',
      querystring.stringify({
        grant_type: 'authorization_code',
        client_id: config.kakao.clientId,
        redirect_uri: url + '/hook/authentication/kakao',
        code,
      })
    );

    kakao_access_token = response.data.access_token;
    expires_in = response.data.expires_in;

    const response2 = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${kakao_access_token}`,
      },
    });

    userInfo = response2.data;

    if (isNil(userInfo))
      throw new GrpcError(status.INTERNAL, 'Kakao did not return user info');

    let user: User | null = await User.getInstance().findOne({
      'kakao.id': userInfo.id,
    });

    if (
      isNil(user) &&
      !isNil(userInfo.kakao_account) &&
      !isNil(userInfo.kakao_account.email)
    ) {
      user = await User.getInstance().findOne({ email: userInfo.email });
    }

    if (isNil(user)) {
      user = await User.getInstance().create({
        email: userInfo?.kakao_account?.email || '',
        kakao: {
          id: userInfo.id,
          token: kakao_access_token,
          tokenExpires: moment().add(expires_in).format(),
          profile_image_url: userInfo?.kakao_account?.profile?.profile_image_url || '',
          thumbnail_image_url:
            userInfo?.kakao_account?.profile?.thumbnail_image_url || '',
        },
        isVerified: true,
      });
    } else {
      if (!user.active) throw new GrpcError(status.PERMISSION_DENIED, 'Inactive user');
      if (!user.kakao) {
        user = await User.getInstance().findByIdAndUpdate(
          user._id,
          {
            kakao: {
              id: userInfo.id,
              token: kakao_access_token,
              tokenExpires: moment().add(expires_in).format(),
              profile_image_url:
                userInfo?.kakao_account?.profile?.profile_image_url || '',
              thumbnail_image_url:
                userInfo?.kakao_account?.profile?.thumbnail_image_url || '',
            },
          },
          true
        );
      }
    }

    const clientId = params.state;

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
        config.kakao.redirect_uri +
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
