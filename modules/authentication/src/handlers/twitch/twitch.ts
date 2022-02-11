import ConduitGrpcSdk from '@conduitplatform/conduit-grpc-sdk';
import axios from 'axios';
import { TwitchUser } from './twitch.user';
import { TwitchSettings } from './twitch.settings';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';

export class TwitchHandlers extends OAuth2<TwitchUser, TwitchSettings> {

  constructor(grpcSdk: ConduitGrpcSdk, settings: TwitchSettings) {
    super(grpcSdk, 'twitch', settings);
  }

  async connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<TwitchUser> {
    let twitch_access_token = details.accessToken;
    let expires_in = undefined;
    let id = undefined;
    let email = undefined;
    let profile_image_url = undefined;
    const response2 = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${twitch_access_token}`,
        'Client-Id': this.settings.clientId,
      },
    });

    id = response2.data.data[0].id;
    email = response2.data.data[0].email;
    //profile_image_url = response2.data.data[0].profile_image_url;

    const payload: TwitchUser = {
      id: id,
      email: email,
      data: {},
    };

    return payload;
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
