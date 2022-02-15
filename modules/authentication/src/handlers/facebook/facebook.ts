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
import { Payload } from '../AuthenticationProviders/interfaces/Payload';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';
import { FacebookSettings } from './facebook.settings';
import { FacebookUser } from './facebook.user';

export class FacebookHandlers extends OAuth2<Payload, FacebookSettings> {

  constructor(grpcSdk: ConduitGrpcSdk,  private readonly routingManager: RoutingManager ,settings: FacebookSettings) {
    super(grpcSdk, 'facebook', settings);
  }

  async connectWithProvider(details: { accessToken: string, clientId: string, scope: any }): Promise<FacebookUser> {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
    const facebookOptions: AxiosRequestConfig = {
      method: 'GET',
      url: 'https://graph.facebook.com/v5.0/me',
      params: {
        access_token: details.accessToken,
        fields: "email,id,name"
      },
    };

    const facebookResponse: any = await axios(facebookOptions).catch((e:any) => console.log(e.message));
    if (isNil(facebookResponse.data.email) || isNil(facebookResponse.data.id)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authentication with facebook failed');
    }


    let payload: FacebookUser = {
      id: facebookResponse.data.id,
      email: facebookResponse.data.email,
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

  declareRoutes() {
    this.routingManager.route(
      {
        path: '/facebook',
        action: ConduitRouteActions.POST,
        description: `Login/register with Facebook by providing a token from the client.`,
        bodyParams: {
          access_token: ConduitString.Required,
        },
      },
      new ConduitRouteReturnDefinition('FacebookResponse', {
        userId: ConduitString.Required,
        accessToken: ConduitString.Required,
        refreshToken: ConduitString.Required,
      }),
      this.authenticate.bind(this),
    );

    this.routingManager.route(
      {
        path: '/init/facebook',
        action: ConduitRouteActions.GET,
        description: `Begins the Facebook authentication`,
      },
      new ConduitRouteReturnDefinition('FacebookInitResponse', 'String'),
      this.redirect.bind(this),
    );

    this.routingManager.route(
      {
        path: '/hook/facebook',
        action: ConduitRouteActions.GET,
        description: `Login/register with Facebook using redirection mechanism.`,
        urlParams: {
          code: ConduitString.Required,
          state: [ConduitString.Optional],
        },
      },
      new ConduitRouteReturnDefinition('FacebookResponse', {
        userId: ConduitString.Required,
        accessToken: ConduitString.Required,
        refreshToken: ConduitString.Required,
      }),
      this.authorize.bind(this),
    );
  }
}
