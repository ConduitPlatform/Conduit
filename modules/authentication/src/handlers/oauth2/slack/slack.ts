import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  GrpcError,
  RoutingManager,
} from '@conduitplatform/grpc-sdk';
import { status } from '@grpc/grpc-js';
import axios from 'axios';
import { OAuth2 } from '../OAuth2';
import { SlackUser } from './slack.user';
import * as slackParameters from './slack.json';
import { OAuth2Settings } from '../interfaces/OAuth2Settings';
import { SlackResponse } from './slack.response';
import { ProviderConfig } from '../interfaces/ProviderConfig';
import { AuthParams } from '../interfaces/AuthParams';
import { Payload } from '../interfaces/Payload';
import { ConnectionParams } from '../interfaces/ConnectionParams';

export class SlackHandlers extends OAuth2<SlackUser, OAuth2Settings> {

  constructor(grpcSdk: ConduitGrpcSdk, config: { slack: ProviderConfig }, serverConfig: { url: string }) {
    super(grpcSdk, 'slack', new OAuth2Settings(serverConfig.url, config.slack, slackParameters));
    this.defaultScopes = ['users:read'];
  }

  async connectWithProvider(details: ConnectionParams): Promise<Payload<SlackUser>> {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
    const slackResponse: SlackResponse = await axios.get('https://slack.com/api/users.profile.get', {
      headers: {
        'Authorization': 'Bearer ' + details.accessToken,
      },
    });
    if (isNil(slackResponse.data.profile.email) || isNil(slackResponse.data.profile.avatar_hash)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authentication with slack failed');
    }


    return {
      id: slackResponse.data.profile.avatar_hash,
      email: slackResponse.data.profile.email,
      data: { ...slackResponse.data.profile },
    };
  }

  makeRequest(data: AuthParams) {
    return {
      method: this.settings.accessTokenMethod,
      url: this.settings.tokenUrl,
      params: { ...data },
      headers: {
        'Accept': 'application/json',
      },
      data: null,
    };
  }

  declareRoutes(routingManager: RoutingManager) {
    routingManager.route(
      {
        path: '/init/slack',
        action: ConduitRouteActions.GET,
        description: `Begins the Slack authentication`,
        bodyParams: {
          scopes: [ConduitString.Optional],
        },
      },
      new ConduitRouteReturnDefinition('SlackInitResponse', 'String'),
      this.redirect.bind(this),
    );

    routingManager.route(
      {
        path: '/hook/slack',
        action: ConduitRouteActions.GET,
        description: `Login/register with Slack using redirection mechanism.`,
        urlParams: {
          code: ConduitString.Required,
          state: [ConduitString.Required],
        },
      },
      new ConduitRouteReturnDefinition('SlackResponse', {
        userId: ConduitString.Required,
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      }),
      this.authorize.bind(this),
    );
  }
}
