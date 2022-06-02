import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  GrpcError,
  RoutingManager,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import axios, { AxiosRequestConfig } from 'axios';
import { OAuth2 } from '../OAuth2';
import { FigmaUser } from './figma.user';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';
import * as figmaParameters from './figma.json';
import { ProviderConfig } from '../interfaces/ProviderConfig';
import { AuthParams } from '../interfaces/AuthParams';
import { ConnectionParams } from '../interfaces/ConnectionParams';
import { Payload } from '../interfaces/Payload';

export class FigmaHandlers extends OAuth2<FigmaUser, OAuth2Settings> {

  constructor(grpcSdk: ConduitGrpcSdk, config: { figma: ProviderConfig }, serverConfig: { url: string }) {
    super(grpcSdk, 'figma', new OAuth2Settings(serverConfig.url, config.figma, figmaParameters));
    this.defaultScopes = ['users:profile:read'];
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<FigmaUser>> {
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

    const figmaResponse: { data: FigmaUser } = await axios(figmaOptions);
    if (isNil(figmaResponse.data.email) || isNil(figmaResponse.data.id)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authentication with figma failed');
    }

    return {
      id: figmaResponse.data.id,
      email: figmaResponse.data.email,
      data: { ...figmaResponse.data },
    };
  }

  declareRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: '/init/figma',
        action: ConduitRouteActions.GET,
        description: `Begins the Figma authentication`,
        bodyParams: {
          scopes: [ConduitString.Optional],
        },
      },
      new ConduitRouteReturnDefinition('FigmaInitResponse', 'String'),
      this.redirect.bind(this),
    );
    routingManager.route(
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
}
