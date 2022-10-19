import { OAuth2 } from '../OAuth2';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ProviderConfig } from '../interfaces/ProviderConfig';
import * as linkedInParameters from './linkedin.json';
import { ConnectionParams } from '../interfaces/ConnectionParams';
import { Payload } from '../interfaces/Payload';
import axios from 'axios';
import { LinkedInUser } from './linkedin.user';

export class LinkedInHandlers extends OAuth2<LinkedInUser, OAuth2Settings> {
  constructor(
    grpcSdk: ConduitGrpcSdk,
    config: { linkedin: ProviderConfig },
    serverConfig: { hostUrl: string },
  ) {
    super(
      grpcSdk,
      'linkedin',
      new OAuth2Settings(serverConfig.hostUrl, config.linkedin, linkedInParameters),
    );
    this.defaultScopes = ['r_emailaddress', 'r_liteprofile'];
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<LinkedInUser>> {
    const linkedIn_access_token = details.accessToken;
    const linkedInProfile = await axios.get('https://api.linkedin.com/v2/me', {
      headers: {
        Authorization: `Bearer ${linkedIn_access_token}`,
      },
    });
    return {
      id: linkedInProfile.data.id,
      email: linkedInProfile.data.email,
      data: { ...linkedInProfile.data },
    };
  }
}
