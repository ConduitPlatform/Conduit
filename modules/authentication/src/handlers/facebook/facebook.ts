import { isEmpty, isNil } from 'lodash';
import ConduitGrpcSdk, { ConduitError, GrpcError, ParsedRouterRequest } from '@conduitplatform/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { ConfigController } from '../../config/Config.controller';
import axios, { AxiosRequestConfig } from 'axios';
import { Payload } from '../AuthenticationProviders/interfaces/Payload';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';
import { FacebookSettings } from './facebook.settings';
import { FacebookUser } from './facebook.user';

export class FacebookHandlers extends OAuth2<Payload, FacebookSettings> {
  private initialized: boolean = false;

  constructor(grpcSdk: ConduitGrpcSdk, settings: FacebookSettings) {
    super(grpcSdk, 'facebook', settings);
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


  async connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<FacebookUser>{
    const facebookOptions: AxiosRequestConfig = {
      method: 'GET',
      url: 'https://graph.facebook.com/v5.0/me',
      params: {
        access_token: details.accessToken,
        fields: details.scope,
      },
    };

    const facebookResponse:any = await axios(facebookOptions);
    if (isNil(facebookResponse.data.email) || isNil(facebookResponse.data.id)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authentication with facebook failed');
    }


    let payload: FacebookUser = {
      id: facebookResponse.data.id,
      email: facebookResponse.data.email,
      data: {}
    };
    delete facebookResponse.data.id;
    delete facebookResponse.data.email;
    payload.data = facebookResponse.data;
    return payload;
  }
}
