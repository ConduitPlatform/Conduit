import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import axios from 'axios';
import { GithubUser } from './github.user';
import { OAuth2 } from '../OAuth2';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';
import * as githubParameters from './github.json';
import { ProviderConfig } from '../interfaces/ProviderConfig';
import { Payload } from '../interfaces/Payload';
import { ConnectionParams } from '../interfaces/ConnectionParams';

export class GithubHandlers extends OAuth2<GithubUser, OAuth2Settings> {
  constructor(grpcSdk: ConduitGrpcSdk, config: { github: ProviderConfig }) {
    super(grpcSdk, 'github', new OAuth2Settings(config.github, githubParameters));
    this.defaultScopes = ['read:user', 'repo'];
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<GithubUser>> {
    const github_access_token = details.accessToken;
    const githubProfile = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${github_access_token}`,
      },
    });
    return {
      id: githubProfile.data.id,
      email: githubProfile.data.email,
      data: { ...githubProfile.data },
    };
  }
}
