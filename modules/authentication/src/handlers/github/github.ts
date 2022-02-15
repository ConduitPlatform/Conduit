import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  RoutingManager,
} from '@conduitplatform/grpc-sdk';
import axios from 'axios';
import { GithubUser } from './github.user';
import { GithubSettings } from './github.settings';
import { OAuth2 } from '../AuthenticationProviders/OAuth2';

export class GithubHandlers extends OAuth2<GithubUser, GithubSettings> {

  constructor(grpcSdk: ConduitGrpcSdk, private readonly routingManager: RoutingManager, settings: GithubSettings) {
    super(grpcSdk, 'github', settings);
  }

  async connectWithProvider(details: { accessToken: string, clientId: string, scope: string }): Promise<GithubUser> {
    let github_access_token = details.accessToken;
    const githubProfile = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${github_access_token}`,
      },
    });
    const githubPayload: GithubUser = {
      id: githubProfile.data.id,
      email: githubProfile.data.email,
      data: { ...githubProfile.data },
    };
    return githubPayload as any;
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
        path: '/init/github',
        action: ConduitRouteActions.GET,
        description: `Begins the Github authentication`,
      },
      new ConduitRouteReturnDefinition('GithubInitResponse', 'String'),
      this.redirect.bind(this),
    );

    this.routingManager.route(
      {
        path: '/hook/github',
        action: ConduitRouteActions.GET,
        description: `Login/register with Github using redirection mechanism.`,
        urlParams: {
          code: ConduitString.Required,
          state: [ConduitString.Required],
        },
      },
      new ConduitRouteReturnDefinition('GithubResponse', {
        userId: ConduitString.Required,
        accessToken: ConduitString.Required,
        refreshToken: ConduitString.Required,
      }),
      this.authorize.bind(this),
    );
  }
}
