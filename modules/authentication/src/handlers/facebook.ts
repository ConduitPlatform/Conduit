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
import { FacebookPayload } from './interfaces/facebook/FacebookPayload';
import { ConnectionCredentials } from './interfaces/ConnectionCredentials';

export class FacebookHandlers extends AuthenticationProviderClass<FacebookPayload> {
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

  async connectWithProvider(options: ConnectionCredentials) {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');

    const config = ConfigController.getInstance().config;

    const facebookOptions: AxiosRequestConfig = {
      method: 'GET',
      url: 'https://graph.facebook.com/v5.0/me',
      params: {
        access_token: options.access_token,
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
    let payload: FacebookPayload = {
      id: facebookResponse.data.id,
      email: facebookResponse.data.email,
      access_token: options.access_token,
    };

    return {
      payload: payload,
      user: user,
    };
  }
}
