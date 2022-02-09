import ConduitGrpcSdk, { ConduitError } from '@conduitplatform/conduit-grpc-sdk';
import axios from 'axios';
import { ConfigController } from '../../config/Config.controller';
import { GithubUser } from './github.user';
import { GithubSettings } from './github.settings';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';

export class GithubHandlers extends OAuth2<GithubUser, GithubSettings> {
  private initialized: boolean = false;

  constructor(grpcSdk: ConduitGrpcSdk, settings: GithubSettings) {
    super(grpcSdk, 'github',settings);
  }

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig.github.enabled) {
      console.log('github not active');
      throw ConduitError.forbidden('Github auth is deactivated');
    }
    if (
      !authConfig.github ||
      !authConfig.github.clientId ||
      !authConfig.github.clientSecret
    ) {
      console.log('github not active');
      throw ConduitError.forbidden(
        'Cannot enable github auth due to missing clientId or client secret',
      );
    }
    console.log('github is active');
    this.initialized = true;
    return true;
  }

  async connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<GithubUser> {
    let github_access_token = details.accessToken;
    let [access_token,scope,token_type] = github_access_token.split('&');
    access_token = access_token.split('=')[1];
    const githubProfile = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${access_token}`,
      },
    });
    const githubPayload = {
      id: githubProfile.data.id,
      email: githubProfile.data.email,
      data: {},
    }
    return githubPayload as any;
  }
}
