import { isNil } from 'lodash';
import ConduitGrpcSdk, { ConduitError, GrpcError } from '@conduitplatform/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import { ConfigController } from '../../config/Config.controller';
import axios, { AxiosRequestConfig } from 'axios';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';
import { FigmaUser } from './figma.user';
import { FigmaSettings } from './figma.settings';
import { SlackUser } from '../slack/slack.user';

export class FigmaHandlers extends OAuth2<FigmaUser, FigmaSettings> {
  private initialized: boolean = false;

  constructor(grpcSdk: ConduitGrpcSdk, settings: FigmaSettings) {
    super(grpcSdk, 'figma', settings);
  }

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;

    if (!authConfig.figma.enabled) {
      console.log('Figma not active');
      throw ConduitError.forbidden('Figma auth is deactivated');
    }
    if (!authConfig.facebook.clientId) {
      console.log('Figma not active');
      throw ConduitError.forbidden('Cannot enable figma auth due to missing clientId');
    }
    console.log('Figma is active');
    this.initialized = true;
    return true;
  }


  async connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<FigmaUser>{
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
    const figmaOptions: AxiosRequestConfig = {
      method: 'GET',
      url: 'https://api.figma.com/v1/me',
      headers: {
        "Authorization": "Bearer " +details.accessToken,
      },
      data: null,
    };

    const slackResponse :any = await axios(figmaOptions).catch((e:any) => console.log(e.message));
    if (isNil(slackResponse.data.email) || isNil(slackResponse.data.id)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authentication with slack failed');
    }


    let payload: SlackUser = {
      id: slackResponse.data.id,
      email: slackResponse.data.email,
      data: {}
    };
    return payload;
    //https://forum.figma.com/t/get-only-user-identity-via-oauth/9783

  }
}