import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  RoutingManager,
} from '@conduitplatform/grpc-sdk';
import axios from 'axios';
import { TwitchUser } from './twitch.user';
import * as twitchParameters from './twitch.json';
import { OAuth2 } from '../OAuth2';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';
import { ProviderConfig } from '../interfaces/ProviderConfig';
import { AuthParams } from '../interfaces/AuthParams';
import { Payload } from '../interfaces/Payload';
import { ConnectionParams } from '../interfaces/ConnectionParams';

export class TwitchHandlers extends OAuth2<TwitchUser, OAuth2Settings> {

  constructor(grpcSdk: ConduitGrpcSdk, config: { twitch: ProviderConfig }, serverConfig: { url: string }) {
    super(grpcSdk, 'twitch', new OAuth2Settings(serverConfig.url, config.twitch, twitchParameters));
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<TwitchUser>> {
    let twitch_access_token = details.accessToken;
    let expires_in = undefined;
    let id;
    let email;
    let profile_image_url;
    const response2 = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${twitch_access_token}`,
        'Client-Id': this.settings.clientId,
      },
    });

    id = response2.data.data[0].id;
    email = response2.data.data[0].email;
    //profile_image_url = response2.data.data[0].profile_image_url;

    return {
      id: id,
      email: email,
      data: { ...response2.data.data[0] },
    };
  }

  makeRequest(data: AuthParams) {
    return {
      method: this.settings.accessTokenMethod,
      url: this.settings.tokenUrl,
      params: { ...data },
      headers: {
        'Accept': 'application/json',
      },
      data: null,
    };
  }

  declareRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: '/hook/twitch',
        action: ConduitRouteActions.GET,
        description: `Login/register with Twitch using redirection mechanism.`,
        urlParams: {
          code: ConduitString.Required,
          state: [ConduitString.Required],
        },
      },
      new ConduitRouteReturnDefinition('TwitchResponse', {
        userId: ConduitString.Required,
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.authorize.bind(this),
    );

    routingManager.route(
      {
        path: '/init/twitch',
        description: `Begins the Twitch authentication.`,
        action: ConduitRouteActions.GET,
        bodyParams: {
          scopes: [ConduitString.Optional],
        },
      },
      new ConduitRouteReturnDefinition('TwitchInitResponse', 'String'),
      this.redirect.bind(this),
    );

  }
}
