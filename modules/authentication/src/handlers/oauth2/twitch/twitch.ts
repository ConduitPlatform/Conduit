import { ConduitGrpcSdk } from '@conduitplatform/grpc-sdk';
import axios from 'axios';
import { TwitchUser } from './twitch.user.js';
import twitchParameters from './twitch.json' with { type: 'json' };
import { OAuth2 } from '../OAuth2.js';
import {
  ConnectionParams,
  OAuth2Settings,
  Payload,
  ProviderConfig,
} from '../interfaces/index.js';

export class TwitchHandlers extends OAuth2<TwitchUser, OAuth2Settings> {
  constructor(grpcSdk: ConduitGrpcSdk, config: { twitch: ProviderConfig }) {
    super(grpcSdk, 'twitch', new OAuth2Settings(config.twitch, twitchParameters));
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<TwitchUser>> {
    const twitch_access_token = details.accessToken;
    let profile_image_url;
    const response2 = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${twitch_access_token}`,
        'Client-Id': this.settings.clientId,
      },
    });

    const id = response2.data.data[0].id;
    const email = response2.data.data[0].email;

    return {
      id: id,
      email: email,
      data: { ...response2.data.data[0] },
    };
  }
}
