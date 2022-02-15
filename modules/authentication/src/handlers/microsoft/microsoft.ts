import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  RoutingManager,
} from '@conduitplatform/conduit-grpc-sdk';
import axios from 'axios';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';
import { MicrosoftUser } from './microsoft.user';
import { MicrosoftSettings } from './microsoft.settings';

export class MicrosoftHandlers extends OAuth2<MicrosoftUser, MicrosoftSettings> {

  constructor(grpcSdk: ConduitGrpcSdk, private readonly routingManager: RoutingManager, settings: MicrosoftSettings) {
    super(grpcSdk, 'microsoft', settings);
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

  async declareRoutes() {
    this.routingManager.route(
      {
        path: '/init/microsoft',
        action: ConduitRouteActions.GET,
        description: `Begins the Microsoft authentication`,
      },
      new ConduitRouteReturnDefinition('MicrosoftInitResponse', 'String'),
      this.redirect.bind(this),
    );
    this.routingManager.route(
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
        accessToken: ConduitString.Required,
        refreshToken: ConduitString.Required,
      }),
      this.authorize.bind(this),
    );
  }

  async constructScopes(scopes: string[]): Promise<string> {
    return Promise.resolve('');
  }
}
