import ConduitGrpcSdk, { ConduitError, ParsedRouterRequest } from '@conduitplatform/conduit-grpc-sdk';
import axios, { AxiosRequestConfig } from 'axios';
import { ConfigController } from '../../config/Config.controller';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';
import { MicrosoftUser } from './microsoft.user';
import { MicrosoftSettings } from './microsoft.settings';

export class MicrosoftHandlers extends OAuth2<MicrosoftUser, MicrosoftSettings> {
  private initialized: boolean = false;

  constructor(grpcSdk: ConduitGrpcSdk, settings: MicrosoftSettings) {
    super(grpcSdk, 'microsoft', settings);
  }

  async validate(): Promise<Boolean> {
    const authConfig = ConfigController.getInstance().config;
    if (!authConfig.microsoft.enabled) {
      console.log('microsoft not active');
      throw ConduitError.forbidden('Microsoft auth is deactivated');
    }
    if (
      !authConfig.microsoft ||
      !authConfig.microsoft.clientId ||
      !authConfig.microsoft.clientSecret
    ) {
      console.log('microsoft not active');
      throw ConduitError.forbidden(
        'Cannot enable microsoft auth due to missing clientId or client secret',
      );
    }
    console.log('microsoft is active');
    this.initialized = true;
    return true;
  }

  async authorize(call: ParsedRouterRequest) {
    const params = call.request.params;
    let body: any = {
      grant_type: this.settings.grant_type,
      client_id: this.settings.clientId,
      client_secret: this.settings.clientSecret,
      redirect_uri: this.settings.callbackUrl,
      code: params.code,
    };
    body = Object.keys(body).map((k) => {
      return k + '=' + body[k];
    }).join('&');

    const providerOptions: AxiosRequestConfig = {
      method: this.settings.accessTokenMethod as any,
      url: this.settings.tokenUrl,
      data: body,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    const providerResponse: any = await axios(providerOptions).catch((e: any) => console.log(e));
    let access_token = providerResponse.data.access_token;
    let state = params.state.split('::');
    state = {
      clientId: state[0],
      scopes: state[1],
    };
    let clientId = state.clientId;
    let payload = await this.connectWithProvider({ accessToken: access_token, clientId, scope: state.scopes });
    let user = await this.createOrUpdateUser(payload);
    const config = ConfigController.getInstance().config;
    let tokens = await this.createTokens(user._id, clientId, config);
    return {
      redirect: this.settings.finalRedirect +
        '?accessToken=' +
        (tokens.accessToken as any) +
        '&refreshToken=' +
        (tokens.refreshToken as any),
    };
  }

  async connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<MicrosoftUser> {
    let microsoftToken = details.accessToken;
    const microsoftResponse: any = await axios.get('https://graph.microsoft.com/v1.0/me/', {
      headers: {
        Authorization: `Bearer ${microsoftToken}`,
        'Content-Type': 'application/json',

      },
    });
    const payload: MicrosoftUser = {
      id: microsoftResponse.data.id,
      email: microsoftResponse.data.mail,
      data: {},
    };
    return payload;
  }
}
