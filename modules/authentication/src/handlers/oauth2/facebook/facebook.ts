import { isNil } from 'lodash-es';
import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitString,
  ConfigController,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import facebookParameters from './facebook.json' assert { type: 'json' };
import axios, { AxiosRequestConfig } from 'axios';
import {
  ConnectionParams,
  OAuth2Settings,
  Payload,
  ProviderConfig,
} from '../interfaces/index.js';
import { OAuth2 } from '../OAuth2.js';
import { FacebookUser } from './facebook.user.js';

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
    const config = ConfigController.getInstance().config;
    routingManager.route(
      {
        path: '/facebook',
        action: ConduitRouteActions.POST,
        description: `Login/register with Facebook by providing a token from the client.`,
        bodyParams: {
          access_token: ConduitString.Required,
          invitationToken: ConduitString.Optional,
          captchaToken: ConduitString.Optional,
          scopes: [ConduitString.Optional],
        },
        middlewares: config.anonymousUsers ? ['authAnonymousMiddleware'] : undefined,
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
