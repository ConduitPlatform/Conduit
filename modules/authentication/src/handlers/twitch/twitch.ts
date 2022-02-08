import ConduitGrpcSdk, { ConduitError, ParsedRouterRequest } from '@conduitplatform/conduit-grpc-sdk';
import axios from 'axios';
import { ConfigController } from '../../config/Config.controller';
import { OAuth2 } from '../models/OAuth2';
import { Payload } from '../interfaces/Payload';

export class TwitchHandlers extends OAuth2<any> {
  private initialized: boolean = false;

  constructor(grpcSdk: ConduitGrpcSdk) {
    super(grpcSdk, 'twitch');
  }

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig.twitch.enabled) {
      console.log('twitch not active');
      throw ConduitError.forbidden('Twitch auth is deactivated');
    }
    if (
      !authConfig.twitch ||
      !authConfig.twitch.clientId ||
      !authConfig.twitch.clientSecret
    ) {
      console.log('twitch not active');
      throw ConduitError.forbidden(
        'Cannot enable twitch auth due to missing clientId or client secret',
      );
    }
    console.log('twitch is active');
    this.initialized = true;
    return true;
  }

  async connectWithProvider(call:ParsedRouterRequest ): Promise<any> {
    const params = call.request.params;
    const code = params.code;

    const config = ConfigController.getInstance().config;

    let serverConfig = await this.grpcSdk.config.getServerConfig();
    let url = serverConfig.url;

    let twitch_access_token = undefined;
    let expires_in = undefined;
    let id = undefined;
    let email = undefined;
    let profile_image_url = undefined;

    const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
      params: {
        client_id: config.twitch.clientId,
        client_secret: config.twitch.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: url + '/hook/authentication/twitch',
      },
    });
    twitch_access_token = response.data.access_token;
    expires_in = response.data.expires_in;

    const response2 = await axios.get('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${twitch_access_token}`,
        'Client-Id': config.twitch.clientId,
      },
    });

    id = response2.data.data[0].id;
    email = response2.data.data[0].email;
    //profile_image_url = response2.data.data[0].profile_image_url;

    const payload: Payload = {
      id: id,
      email: email,
      clientId: params.state,
    };

    return payload;
  }
}
