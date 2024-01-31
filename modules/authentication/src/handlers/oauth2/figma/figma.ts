import { isNil } from 'lodash-es';
import ConduitGrpcSdk, { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import axios, { AxiosRequestConfig } from 'axios';
import { OAuth2 } from '../OAuth2.js';
import { FigmaUser } from './figma.user.js';
import {
  ConnectionParams,
  OAuth2Settings,
  Payload,
  ProviderConfig,
} from '../interfaces/index.js';
import figmaParameters from './figma.json' assert { type: 'json' };

export class FigmaHandlers extends OAuth2<FigmaUser, OAuth2Settings> {
  constructor(grpcSdk: ConduitGrpcSdk, config: { figma: ProviderConfig }) {
    super(grpcSdk, 'figma', new OAuth2Settings(config.figma, figmaParameters));
    this.defaultScopes = ['users:profile:read'];
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<FigmaUser>> {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
    const figmaOptions: AxiosRequestConfig = {
      method: 'GET',
      url: 'https://api.figma.com/v1/me',
      headers: {
        Authorization: 'Bearer ' + details.accessToken,
      },
      data: null,
    };

    const figmaResponse: { data: FigmaUser } = await axios(figmaOptions);
    if (isNil(figmaResponse.data.email) || isNil(figmaResponse.data.id)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authentication with figma failed');
    }

    return {
      id: figmaResponse.data.id,
      email: figmaResponse.data.email,
      data: { ...figmaResponse.data },
    };
  }
}
