import ConduitGrpcSdk from '@conduitplatform/conduit-grpc-sdk';
import axios from 'axios';
import { GithubUser } from './github.user';
import { GithubSettings } from './github.settings';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';

export class GithubHandlers extends OAuth2<GithubUser, GithubSettings> {

  constructor(grpcSdk: ConduitGrpcSdk, settings: GithubSettings) {
    super(grpcSdk, 'github', settings);
  }

  async connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<GithubUser> {
    let github_access_token = details.accessToken;
    const githubProfile = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${github_access_token}`,
      },
    });
    const githubPayload = {
      id: githubProfile.data.id,
      email: githubProfile.data.email,
      data: {},
    };
    return githubPayload as any;
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
