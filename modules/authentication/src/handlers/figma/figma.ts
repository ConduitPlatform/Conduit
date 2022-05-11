import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  GrpcError,
  RoutingManager, TYPE,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import axios, { AxiosRequestConfig } from 'axios';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';
import { FigmaUser } from './figma.user';
import { FigmaSettings } from './figma.settings';

export class FigmaHandlers extends OAuth2<FigmaUser, FigmaSettings> {

  constructor(grpcSdk: ConduitGrpcSdk, private readonly routingManager: RoutingManager, settings: FigmaSettings) {
    super(grpcSdk, 'figma', settings);
    this.defaultScopes = ["users:profile:read"];
  }

  async connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<FigmaUser> {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
    const figmaOptions: AxiosRequestConfig = {
      method: 'GET',
      url: 'https://api.figma.com/v1/me',
      headers: {
        'Authorization': 'Bearer ' + details.accessToken,
      },
      data: null,
    };

    const figmaResponse: any = await axios(figmaOptions).catch((e) => console.log(e.message));
    if (isNil(figmaResponse.data.email) || isNil(figmaResponse.data.id)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authentication with figma failed');
    }

    let payload: FigmaUser = {
      id: figmaResponse.data.id,
      email: figmaResponse.data.email,
      data: { ...figmaResponse.data },
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

  declareRoutes() {
    this.routingManager.route(
      {
        path: '/init/figma',
        action: ConduitRouteActions.GET,
        description: `Begins the Figma authentication`,
        bodyParams: {
          scopes: [ConduitString.Optional]
        }
      },
      new ConduitRouteReturnDefinition('FigmaInitResponse', 'String'),
      this.redirect.bind(this),
    );
    this.routingManager.route(
      {
        path: '/hook/figma',
        action: ConduitRouteActions.GET,
        description: `Login/register with Figma using redirection mechanism.`,
        urlParams: {
          code: ConduitString.Required,
          state: [ConduitString.Required],
        },
      },
      new ConduitRouteReturnDefinition('FigmaResponse', {
        userId: ConduitString.Required,
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.authorize.bind(this),
    );
  }

  async constructScopes(scopes: string[]): Promise<any> {
    return scopes;
  }
}