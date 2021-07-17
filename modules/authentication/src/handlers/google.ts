import { OAuth2Client } from 'google-auth-library';
import { isEmpty, isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConduitError,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@quintessential-sft/conduit-grpc-sdk';
import grpc from 'grpc';
import { ConfigController } from '../config/Config.controller';
import { AuthUtils } from '../utils/auth';
import { User } from '../models';
import moment = require('moment');

export class GoogleHandlers {
  private readonly client: OAuth2Client;
  private initialized: boolean = false;

  constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this.client = new OAuth2Client();
  }

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig.google.enabled) {
      console.log('Google not active');
      throw ConduitError.forbidden('Google auth is deactivated');
    }
    if (!authConfig.google.clientId) {
      console.log('Google not active');
      throw ConduitError.forbidden('Cannot enable google auth due to missing clientId');
    }
    console.log('Google is active');
    this.initialized = true;
    return true;
  }

  async authenticate(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    if (!this.initialized)
      throw new GrpcError(grpc.status.NOT_FOUND, 'Requested resource not found');
    const { id_token, access_token, expires_in } = call.request.params;

    const config = ConfigController.getInstance().config;

    const context = call.request.context;
    if (isNil(context) || isEmpty(context))
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'No headers provided');

    const ticket = await this.client.verifyIdToken({
      idToken: id_token,
      audience: config.google.clientId,
    });

    const payload = ticket.getPayload();
    if (isNil(payload)) {
      throw new GrpcError(
        grpc.status.UNAUTHENTICATED,
        'Received invalid response from the Google API'
      );
    }
    if (!payload.email_verified) {
      throw new GrpcError(grpc.status.UNAUTHENTICATED, 'Unauthorized');
    }

    let user: User | null = await User.getInstance().findOne({ email: payload.email });

    if (!isNil(user)) {
      if (!user.active)
        throw new GrpcError(grpc.status.PERMISSION_DENIED, 'Inactive user');
      if (!config.google.accountLinking) {
        throw new GrpcError(
          grpc.status.PERMISSION_DENIED,
          'User with this email already exists'
        );
      }
      if (isNil(user.google)) {
        user.google = {
          id: payload.sub,
          token: access_token,
          tokenExpires: moment()
            .add(expires_in as number, 'milliseconds')
            .toDate(),
        };
        if (!user.isVerified) user.isVerified = true;
        user = await User.getInstance().findByIdAndUpdate(user._id, user);
      }
    } else {
      user = await User.getInstance().create({
        email: payload.email,
        google: {
          id: payload.sub,
          token: access_token,
          tokenExpires: moment().add(expires_in).format(),
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
