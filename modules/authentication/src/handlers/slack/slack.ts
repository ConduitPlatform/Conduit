import { isNil } from 'lodash';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  GrpcError,
  RoutingManager,
} from '@conduitplatform/conduit-grpc-sdk';
import { status } from '@grpc/grpc-js';
import axios, { AxiosRequestConfig } from 'axios';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';
import { SlackSettings } from './slack.settings';
import { SlackUser } from './slack.user';

export class SlackHandlers extends OAuth2<SlackUser, SlackSettings> {

  constructor(grpcSdk: ConduitGrpcSdk, private readonly routingManager: RoutingManager, settings: SlackSettings) {
    super(grpcSdk, 'slack', settings);
  }

  async connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<SlackUser> {
    if (!this.initialized)
      throw new GrpcError(status.NOT_FOUND, 'Requested resource not found');
    const slackOptions: AxiosRequestConfig = {
      method: 'GET',
      url: 'https://slack.com/api/users.profile.get',
      headers: {
        'Authorization': 'Bearer ' + details.accessToken,
      },
    };

    const slackResponse: any = await axios(slackOptions);
    if (isNil(slackResponse.data.profile.email) || isNil(slackResponse.data.profile.avatar_hash)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authentication with slack failed');
    }


    let payload: SlackUser = {
      id: slackResponse.data.profile.avatar_hash,
      email: slackResponse.data.profile.email,
      data: { ...slackResponse.data.profile },
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
        path: '/init/slack',
        action: ConduitRouteActions.GET,
        description: `Begins the Slack authentication`,
      },
      new ConduitRouteReturnDefinition('SlackInitResponse', 'String'),
      this.redirect.bind(this),
    );

    this.routingManager.route(
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
        accessToken: ConduitString.Required,
        refreshToken: ConduitString.Required,
      }),
      this.authorize.bind(this),
    );
  }
}
