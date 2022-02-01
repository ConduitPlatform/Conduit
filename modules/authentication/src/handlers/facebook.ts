import { isEmpty, isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConduitError,
  GrpcError,
  ParsedRouterRequest,
  UnparsedRouterResponse,
} from '@conduitplatform/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { ConfigController } from '../config/Config.controller';
import { User } from '../models';
import axios, { AxiosRequestConfig } from 'axios';
import { AuthenticationProviderClass } from './models/AuthenticationProviderClass';
import { Payload } from './interfaces/Payload';

export class FacebookHandlers extends AuthenticationProviderClass {
  private initialized: boolean = false;

  constructor(grpcSdk: ConduitGrpcSdk) {
    super(grpcSdk, 'facebook');
  }

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

    const payload: Payload = {
      user: user!,
      config: config,
      data: {
        id: facebookResponse.data.id,
        token: access_token,
      },
      email: facebookResponse.data.email,
      clientId: context.clientId,
    };
    return await this.createTokens(payload);
  }
}
