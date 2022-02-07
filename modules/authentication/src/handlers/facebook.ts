import { isEmpty, isNil } from 'lodash';
import ConduitGrpcSdk, { ConduitError, GrpcError, ParsedRouterRequest } from '@conduitplatform/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { ConfigController } from '../config/Config.controller';
import axios, { AxiosRequestConfig } from 'axios';
import { AuthenticationProviderClass } from './models/AuthenticationProviderClass';
import { Payload } from './interfaces/Payload';

export class FacebookHandlers extends AuthenticationProviderClass<Payload> {
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

  async connectWithProvider(call: ParsedRouterRequest) {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
    let { access_token } = call.request.params;
    const context = call.request.context;
    if (( isNil(context) || isEmpty(context)) && !call.request.path.startsWith('/hook'))
      throw new GrpcError(status.UNAUTHENTICATED, 'No headers provided');
    const facebookOptions: AxiosRequestConfig = {
      method: 'GET',
      url: 'https://graph.facebook.com/v5.0/me',
      params: {
        access_token: access_token,
        fields: 'id,email',
      },
    };

    const facebookResponse:any = await axios(facebookOptions);
    if (isNil(facebookResponse.data.email) || isNil(facebookResponse.data.id)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authentication with facebook failed');
    }
    let payload: Payload = {
      id: facebookResponse.data.id,
      email: facebookResponse.data.email,
      access_token: access_token,
      clientId: context.clientId,
    };
    return payload;
  }
}
