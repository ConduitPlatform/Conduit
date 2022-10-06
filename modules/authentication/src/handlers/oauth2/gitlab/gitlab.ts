import { OAuth2 } from '../OAuth2';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ProviderConfig } from '../interfaces/ProviderConfig';
import * as gitlabParameters from '../gitlab/gitlab.json';
import { ConnectionParams } from '../interfaces/ConnectionParams';
import { Payload } from '../interfaces/Payload';
import axios from 'axios';
import { GitlabUser } from './gitlab.user';

export class GitlabHandlers extends OAuth2<GitlabUser, OAuth2Settings> {
  constructor(
    grpcSdk: ConduitGrpcSdk,
    config: { gitlab: ProviderConfig },
    serverConfig: { hostUrl: string },
  ) {
    super(
      grpcSdk,
      'gitlab',
      new OAuth2Settings(serverConfig.hostUrl, config.gitlab, gitlabParameters),
    );
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
