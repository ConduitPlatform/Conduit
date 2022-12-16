import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  GrpcError,
  RoutingManager,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import * as facebookParameters from './facebook.json';
import axios, { AxiosRequestConfig } from 'axios';
import { Payload } from '../interfaces/Payload';
import { OAuth2 } from '../OAuth2';
import { FacebookUser } from './facebook.user';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';
import { ProviderConfig } from '../interfaces/ProviderConfig';
import { ConnectionParams } from '../interfaces/ConnectionParams';

export class FacebookHandlers extends OAuth2<FacebookUser, OAuth2Settings> {
  constructor(grpcSdk: ConduitGrpcSdk, config: { facebook: ProviderConfig }) {
    super(grpcSdk, 'facebook', new OAuth2Settings(config.facebook, facebookParameters));
    this.mapScopes = {
      email: 'email',
      user_birthday: 'birthday',
      user_gender: 'gender',
      user_friends: 'friends',
      public_profile: 'id,name,first_name,last_name,picture',
      user_location: 'location',
      user_link: 'link',
      user_posts: 'posts',
      user_photos: 'photos',
      user_videos: 'videos',
      user_hometown: 'hometown',
      user_age_range: 'age_range',
      user_likes: 'likes',
    };
    this.defaultScopes = ['public_profile', 'email'];
  }

  makeFields(scopes: string[]): string {
    return scopes
      .map((scope: string) => {
        return this.mapScopes[scope];
      })
      .join(',');
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<FacebookUser>> {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');

    const facebookOptions: AxiosRequestConfig = {
      params: {
        access_token: details.accessToken,
        fields: this.makeFields(details.scope.split(',')),
      },
    };
    const facebookResponse: { data: FacebookUser } = await axios.get(
      'https://graph.facebook.com/v13.0/me',
      facebookOptions,
    );
    if (isNil(facebookResponse.data.email) || isNil(facebookResponse.data.id)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authentication with facebook failed');
    }

    return {
      id: facebookResponse.data.id,
      email: facebookResponse.data.email,
      data: { ...facebookResponse.data },
    };
  }

  declareRoutes(routingManager: RoutingManager) {
    super.declareRoutes(routingManager);
    routingManager.route(
      {
        path: '/facebook',
        action: ConduitRouteActions.POST,
        description: `Login/register with Facebook by providing a token from the client.`,
        bodyParams: {
          access_token: ConduitString.Required,
          invitationToken: ConduitString.Optional,
        },
        queryParams: {
          captchaToken: ConduitString.Optional,
        },
      },
      new ConduitRouteReturnDefinition('FacebookResponse', {
        userId: ConduitString.Required,
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.authenticate.bind(this),
    );
  }
}
