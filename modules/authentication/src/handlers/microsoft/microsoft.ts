import ConduitGrpcSdk, { ConduitError } from '@conduitplatform/conduit-grpc-sdk';
import axios from 'axios';
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

  async makeRequest(data: any) {
    data = Object.keys(data).map((k) => {
      return k + '=' + data[k];
    }).join('&');

    return {
      method: this.settings.accessTokenMethod as any,
      url: this.settings.tokenUrl,
      data: data,
      headers: {
        'Accept': 'application/json',
      },
    };

  }
}
