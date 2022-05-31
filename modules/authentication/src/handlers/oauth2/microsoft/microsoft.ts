import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  RoutingManager,
} from '@conduitplatform/grpc-sdk';
import axios from 'axios';
import { OAuth2 } from '../OAuth2';
import { MicrosoftUser } from './microsoft.user';
import { MicrosoftSettings } from './microsoft.settings';
import * as microsoftParameters from './microsoft.json';
import { ProviderConfig } from '../interfaces/ProviderConfig';
import { AuthParams } from '../interfaces/AuthParams';

export class MicrosoftHandlers extends OAuth2<MicrosoftUser, MicrosoftSettings> {

  constructor(grpcSdk: ConduitGrpcSdk, config: { microsoft: ProviderConfig }, serverConfig: { url: string }) {
    super(grpcSdk, 'microsoft', new MicrosoftSettings(serverConfig.url, config.microsoft, microsoftParameters));
    this.defaultScopes = ['openid'];
  }

  async connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<MicrosoftUser> {
    let microsoftToken = details.accessToken;
    const microsoftResponse: MicrosoftUser = await axios.get('https://graph.microsoft.com/v1.0/me/', {
      headers: {
        Authorization: `Bearer ${microsoftToken}`,
        'Content-Type': 'application/json',

      },
    });
    return {
      id: microsoftResponse.data.id,
      email: microsoftResponse.data.mail,
      data: { ...microsoftResponse.data },
    };
  }

  makeRequest(data: AuthParams) {
    let requestData: string = Object.keys(data).map((k) => {
      return k + '=' + data[k as keyof AuthParams];
    }).join('&');

    return {
      method: this.settings.accessTokenMethod,
      url: this.settings.tokenUrl,
      data: requestData,
      headers: {
        'Accept': 'application/json',
      },
    };
  }

  declareRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: '/init/microsoft',
        action: ConduitRouteActions.GET,
        description: `Begins the Microsoft authentication`,
        bodyParams: {
          scopes: [ConduitString.Optional],
        },
      },
      new ConduitRouteReturnDefinition('MicrosoftInitResponse', 'String'),
      this.redirect.bind(this),
    );
    routingManager.route(
      {
        path: '/hook/microsoft',
        action: ConduitRouteActions.GET,
        description: `Login/register with Microsoft using redirection mechanism.`,
        urlParams: {
          code: ConduitString.Required,
          state: [ConduitString.Required],
        },
      },
      new ConduitRouteReturnDefinition('MicrosoftResponse', {
        userId: ConduitString.Required,
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.authorize.bind(this),
    );
  }
}
