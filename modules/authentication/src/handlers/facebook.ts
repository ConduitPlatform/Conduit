import { isEmpty, isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConduitError,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { ConfigController } from '../config/Config.controller';
import { AuthUtils } from '../utils/auth';
import { User } from '../models';
import axios, { AxiosRequestConfig } from 'axios';

export class FacebookHandlers {
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {}

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;

    if (!authConfig.facebook.enabled) {
      console.log('Facebook not active');
      throw ConduitError.forbidden('Facebook auth is deactivated');
    }
    if (!authConfig.facebook.clientId) {
      console.log('Facebook not active');
      throw ConduitError.forbidden('Cannot enable facebook auth due to missing clientId');
    }
    console.log('Facebook is active');
    this.initialized = true;
    return true;
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
    const { access_token } = call.request.params;

    const config = ConfigController.getInstance().config;

    const context = call.request.context;
    if (isNil(context) || isEmpty(context))
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');

    const facebookOptions: AxiosRequestConfig = {
      method: 'GET',
      url: 'https://graph.facebook.com/v5.0/me',
      params: {
        access_token,
        fields: 'id,email',
      },
    };

    const facebookResponse = await axios(facebookOptions);

    if (isNil(facebookResponse.data.email) || isNil(facebookResponse.data.id)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authentication with facebook failed');
    }

    let user: User | null = await User.getInstance().findOne({
      email: facebookResponse.data.email,
    });

    if (!isNil(user)) {
      if (!user.active) throw new GrpcError(status.PERMISSION_DENIED, 'Inactive user');
      if (!config.facebook.accountLinking) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          'User with this email already exists'
        );
      }
      if (isNil(user.facebook)) {
        user.facebook = {
          id: facebookResponse.data.id as string,
          token: access_token,
        };
        // TODO look into this again, as the email the user has registered will still not be verified
        if (!user.isVerified) user.isVerified = true;
        user = await User.getInstance().findByIdAndUpdate(user._id, user);
      }
    } else {
      user = await User.getInstance().create({
        email: facebookResponse.data.email,
        facebook: {
          id: facebookResponse.data.id,
        },
        isVerified: true,
      });
    }

    const [accessToken, refreshToken] = await AuthUtils.createUserTokensAsPromise(
      this.grpcSdk,
      {
        userId: user!._id,
        clientId: context.clientId,
        config,
      }
    );

    return {
      userId: user!._id.toString(),
      accessToken: (accessToken as any).token,
      refreshToken: (refreshToken as any).token,
    };
  }
}
