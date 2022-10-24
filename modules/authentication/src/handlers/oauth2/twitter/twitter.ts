import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import axios from 'axios';
import { OAuth2 } from '../OAuth2';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';
import * as twitterParameters from './twitter.json';
import { ProviderConfig } from '../interfaces/ProviderConfig';
import { Payload } from '../interfaces/Payload';
import { ConnectionParams } from '../interfaces/ConnectionParams';
import { TwitterUser } from './twitter.user';
import { AuthParams } from '../interfaces/AuthParams';

export class TwitterHandlers extends OAuth2<TwitterUser, OAuth2Settings> {
  constructor(grpcSdk: ConduitGrpcSdk, config: { twitter: ProviderConfig }) {
    super(grpcSdk, 'twitter', new OAuth2Settings(config.twitter, twitterParameters));
    this.defaultScopes = ['tweet.read', 'users.read', 'offline.access'];
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<TwitterUser>> {
    const twitter_access_token = details.accessToken;
    const twitterProfile = await axios.get('https://api.twitter.com/2/users/me', {
      headers: {
        Authorization: `Bearer ${twitter_access_token}`,
      },
    });
    return {
      id: twitterProfile.data.data.id,
      email: twitterProfile.data.data.email,
      data: { ...twitterProfile.data.data },
    };
  }
  constructScopes(scopes: string[]): string {
    return scopes.join('%20');
  }

  makeRequest(data: AuthParams) {
    return {
      method: this.settings.accessTokenMethod,
      url: this.settings.tokenUrl,
      data: `grant_type=${data.grant_type}&code=${data.code}&redirect_uri=${data.redirect_uri}&code_verifier=${data.code_verifier}`,
      headers: {
        authorization: `Basic ${Buffer.from(
          this.settings.clientId + ':' + this.settings.clientSecret,
        ).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };
  }
}
