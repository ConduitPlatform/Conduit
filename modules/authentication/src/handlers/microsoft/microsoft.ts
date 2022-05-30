import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  RoutingManager, TYPE,
} from '@conduitplatform/grpc-sdk';
import axios from 'axios';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';
import { MicrosoftUser } from './microsoft.user';
import { MicrosoftSettings } from './microsoft.settings';

export class MicrosoftHandlers extends OAuth2<MicrosoftUser, MicrosoftSettings> {

  constructor(grpcSdk: ConduitGrpcSdk, settings: MicrosoftSettings) {
    super(grpcSdk, 'microsoft', settings);
    this.defaultScopes = ["openid"];
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
      data: { ...microsoftResponse.data },
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

  declareRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: '/init/microsoft',
        action: ConduitRouteActions.GET,
        description: `Begins the Microsoft authentication`,
        bodyParams: {
          scopes: [ConduitString.Optional]
        }
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

  async constructScopes(scopes: string[]): Promise<string> {
    return scopes.join(',')
  }
}
