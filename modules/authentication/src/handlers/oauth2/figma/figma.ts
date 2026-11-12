import { isNil } from 'lodash-es';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import { ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../../errors.js';
import axios, { AxiosRequestConfig } from 'axios';
import { OAuth2 } from '../OAuth2.js';
import { FigmaUser } from './figma.user.js';
import {
  ConnectionParams,
  OAuth2Settings,
  Payload,
  ProviderConfig,
} from '../interfaces/index.js';
import figmaParameters from './figma.json' with { type: 'json' };

export class FigmaHandlers extends OAuth2<FigmaUser, OAuth2Settings> {
  constructor(grpcSdk: ConduitGrpcSdk, config: { figma: ProviderConfig }) {
    super(grpcSdk, 'figma', new OAuth2Settings(config.figma, figmaParameters));
    this.defaultScopes = ['users:profile:read'];
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<FigmaUser>> {
    if (!this.initialized) throw new ModuleError(errors.STRATEGY_DISABLED);
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
      throw new ModuleError({
        ...errors.OAUTH_PROVIDER_AUTH_FAILED,
        message: 'Authentication with figma failed',
      });
    }

    return {
      id: figmaResponse.data.id,
      email: figmaResponse.data.email,
      data: { ...figmaResponse.data },
    };
  }
}
