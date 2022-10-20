import { isNil } from 'lodash';
import ConduitGrpcSdk, { GrpcError } from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import axios, { AxiosRequestConfig } from 'axios';
import { OAuth2 } from '../OAuth2';
import { FigmaUser } from './figma.user';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';
import * as figmaParameters from './figma.json';
import { ProviderConfig } from '../interfaces/ProviderConfig';
import { ConnectionParams } from '../interfaces/ConnectionParams';
import { Payload } from '../interfaces/Payload';

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
