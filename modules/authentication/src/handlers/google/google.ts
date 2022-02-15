import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  GrpcError,
  RoutingManager,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';
import { GoogleSettings } from './google.settings';
import { GoogleUser } from './google.user';
import axios from 'axios';

export class GoogleHandlers extends OAuth2<GoogleUser, GoogleSettings> {
  constructor(grpcSdk: ConduitGrpcSdk, private readonly routingManager: RoutingManager, settings: GoogleSettings) {
    super(grpcSdk, 'google', settings);
  }

  async connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<GoogleUser> {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');

    const googleUser = await axios
      .get(
        `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${details.accessToken}&token_type=Bearer`,
      )
      .then((res) => res.data)
      .catch((error) => {
        console.error(`Failed to fetch user`);
        throw new Error(error.message);
      });

    let googlePayload: GoogleUser = {
      id: googleUser.id,
      email: googleUser.email,
      data: {
        name: googleUser.name,
        given_name: googleUser.givenName,
        locale: googleUser.locale,
        verified_email: googleUser.verified_email,
        picture: googleUser.picture,
        family_name: googleUser.familyName,
      },
    };
    return googlePayload;
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
        path: '/google',
        action: ConduitRouteActions.POST,
        description: `Login/register with Google by providing a token from the client.`,
        bodyParams: {
          id_token: ConduitString.Required,
          access_token: ConduitString.Required,
          expires_in: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('GoogleResponse', {
        userId: ConduitString.Required,
        accessToken: ConduitString.Required,
        refreshToken: ConduitString.Required,
      }),
      this.authenticate.bind(this),
    );

    this.routingManager.route(
      {
        path: '/init/google',
        action: ConduitRouteActions.GET,
        description: `Begins the Google authentication`,
      },
      new ConduitRouteReturnDefinition('GoogleInitResponse', 'String'),
      this.redirect.bind(this),
    );

    this.routingManager.route(
      {
        path: '/hook/google',
        action: ConduitRouteActions.GET,
        description: `Login/register with Google using redirection mechanism.`,
        urlParams: {
          code: ConduitString.Required,
          state: [ConduitString.Required],
        },
      },
      new ConduitRouteReturnDefinition('GoogleResponse', {
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
