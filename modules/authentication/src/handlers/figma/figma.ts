import { isNil } from 'lodash';
import ConduitGrpcSdk, { GrpcError } from '@conduitplatform/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import axios, { AxiosRequestConfig } from 'axios';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';
import { FigmaUser } from './figma.user';
import { FigmaSettings } from './figma.settings';
import { SlackUser } from '../slack/slack.user';

export class FigmaHandlers extends OAuth2<FigmaUser, FigmaSettings> {

  constructor(grpcSdk: ConduitGrpcSdk, settings: FigmaSettings) {
    super(grpcSdk, 'figma', settings);
  }

  async connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<FigmaUser> {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
    const figmaOptions: AxiosRequestConfig = {
      method: 'GET',
      url: 'https://api.figma.com/v1/me',
      headers: {
        'Authorization': 'Bearer ' + details.accessToken,
      },
      data: null,
    };

    const figmaResponse: any = await axios(figmaOptions).catch((e: any) => console.log(e.message));
    if (isNil(figmaResponse.data.email) || isNil(figmaResponse.data.id)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authentication with figma failed');
    }

    let payload: SlackUser = {
      id: figmaResponse.data.id,
      email: figmaResponse.data.email,
      data: {},
    };
    return payload;
  }

  async makeRequest(data: any) {
    return {
      method: this.settings.accessTokenMethod as any,
      url: this.settings.tokenUrl,
      params: { ...data },
      headers: {
        'Accept': 'application/json',
      },
      data: null,
    };
  }
}