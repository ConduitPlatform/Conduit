import { OAuth2 } from '../OAuth2.js';
import {
  ConnectionParams,
  OAuth2Settings,
  Payload,
  ProviderConfig,
} from '../interfaces/index.js';
import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import linkedInParameters from './linkedin.json' with { type: 'json' };
import axios from 'axios';
import { LinkedInUser } from './linkedin.user.js';

export class LinkedInHandlers extends OAuth2<LinkedInUser, OAuth2Settings> {
  constructor(grpcSdk: ConduitGrpcSdk, config: { linkedin: ProviderConfig }) {
    super(grpcSdk, 'linkedin', new OAuth2Settings(config.linkedin, linkedInParameters));
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
