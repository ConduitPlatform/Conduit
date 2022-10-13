import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import axios from 'axios';
import { OAuth2 } from '../OAuth2';
import { MicrosoftUser } from './microsoft.user';
import * as microsoftParameters from './microsoft.json';
import { ProviderConfig } from '../interfaces/ProviderConfig';
import { AuthParams } from '../interfaces/AuthParams';
import { Payload } from '../interfaces/Payload';
import { ConnectionParams } from '../interfaces/ConnectionParams';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';

export class MicrosoftHandlers extends OAuth2<MicrosoftUser, OAuth2Settings> {
  constructor(
    grpcSdk: ConduitGrpcSdk,
    config: { microsoft: ProviderConfig },
    serverConfig: { hostUrl: string },
  ) {
    super(
      grpcSdk,
      'microsoft',
      new OAuth2Settings(serverConfig.hostUrl, config.microsoft, microsoftParameters),
    );
    this.defaultScopes = ['openid'];
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<MicrosoftUser>> {
    const microsoftToken = details.accessToken;
    const microsoftResponse: { data: MicrosoftUser } = await axios.get(
      'https://graph.microsoft.com/v1.0/me/',
      {
        headers: {
          Authorization: `Bearer ${microsoftToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
    return {
      id: microsoftResponse.data.id,
      email: microsoftResponse.data.mail,
      data: { ...microsoftResponse.data },
    };
  }

  makeRequest(data: AuthParams) {
    const requestData: string = Object.keys(data)
      .map(k => {
        return k + '=' + data[k as keyof AuthParams];
      })
      .join('&');

    return {
      method: this.settings.accessTokenMethod,
      url: this.settings.tokenUrl,
      data: requestData,
      headers: {
        Accept: 'application/json',
      },
    };
  }
}
