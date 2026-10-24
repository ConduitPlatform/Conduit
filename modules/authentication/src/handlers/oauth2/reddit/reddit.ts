import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import axios from 'axios';
import { RedditUser } from './reddit.user.js';
import { OAuth2 } from '../OAuth2.js';
import {
  AuthParams,
  ConnectionParams,
  OAuth2Settings,
  Payload,
  ProviderConfig,
} from '../interfaces/index.js';
import redditParameters from './reddit.json' with { type: 'json' };

export class RedditHandlers extends OAuth2<RedditUser, OAuth2Settings> {
  constructor(grpcSdk: ConduitGrpcSdk, config: { reddit: ProviderConfig }) {
    super(grpcSdk, 'reddit', new OAuth2Settings(config.reddit, redditParameters));
    this.defaultScopes = ['identity'];
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<RedditUser>> {
    const reddit_access_token = details.accessToken;
    const redditProfile = await axios.get('https://oauth.reddit.com/api/v1/me', {
      headers: {
        Authorization: `bearer ${reddit_access_token}`,
      },
    });
    return {
      id: redditProfile.data.id,
      email: redditProfile.data.email,
      data: { ...redditProfile.data },
    };
  }

  makeRequest(data: AuthParams, settings: OAuth2Settings = this.settings) {
    return {
      method: settings.accessTokenMethod,
      url: settings.tokenUrl,
      data: `grant_type=${data.grant_type}&code=${data.code}&redirect_uri=${data.redirect_uri}`,
      headers: {
        authorization: `Basic ${Buffer.from(
          settings.clientId + ':' + settings.clientSecret,
        ).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };
  }
}
