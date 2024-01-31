import { OAuth2 } from '../OAuth2.js';
import {
  ConnectionParams,
  OAuth2Settings,
  Payload,
  ProviderConfig,
} from '../interfaces/index.js';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import gitlabParameters from '../gitlab/gitlab.json' assert { type: 'json' };
import axios from 'axios';
import { GitlabUser } from './gitlab.user.js';

export class GitlabHandlers extends OAuth2<GitlabUser, OAuth2Settings> {
  constructor(grpcSdk: ConduitGrpcSdk, config: { gitlab: ProviderConfig }) {
    super(grpcSdk, 'gitlab', new OAuth2Settings(config.gitlab, gitlabParameters));
    this.defaultScopes = ['read_user'];
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<GitlabUser>> {
    const gitlab_access_token = details.accessToken;
    const gitlabProfile = await axios.get('https://gitlab.com/api/v4/user', {
      headers: {
        Authorization: `Bearer ${gitlab_access_token}`,
      },
    });
    return {
      id: gitlabProfile.data.id,
      email: gitlabProfile.data.email,
      data: { ...gitlabProfile.data },
    };
  }
}
