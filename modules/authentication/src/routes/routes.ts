import { LocalHandlers } from '../handlers/local';
import { status } from '@grpc/grpc-js';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitString,
  ConfigController,
  GrpcError,
  GrpcServer,
  ParsedRouterRequest,
  RoutingManager,
  UnparsedRouterResponse,
} from '@conduitplatform/grpc-sdk';
import { FacebookHandlers } from '../handlers/facebook/facebook';
import { GoogleHandlers } from '../handlers/google/google';
import { CommonHandlers } from '../handlers/common';
import { ServiceHandler } from '../handlers/service';
import { TwitchHandlers } from '../handlers/twitch/twitch';
import { isNil } from 'lodash';
import moment from 'moment';
import { AccessToken, User } from '../models';
import { GoogleSettings } from '../handlers/google/google.settings';
import { FacebookSettings } from '../handlers/facebook/facebook.settings';
import { TwitchSettings } from '../handlers/twitch/twitch.settings';
import { GithubHandlers } from '../handlers/github/github';
import { GithubSettings } from '../handlers/github/github.settings';
import { SlackSettings } from '../handlers/slack/slack.settings';
import { SlackHandlers } from '../handlers/slack/slack';
import { FigmaHandlers } from '../handlers/figma/figma';
import { FigmaSettings } from '../handlers/figma/figma.settings';
import { MicrosoftHandlers } from '../handlers/microsoft/microsoft';
import { MicrosoftSettings } from '../handlers/microsoft/microsoft.settings';
import { PhoneHandlers } from '../handlers/phone';

export class AuthenticationRoutes {
  private readonly localHandlers: LocalHandlers;
  private readonly serviceHandler: ServiceHandler;
  private readonly commonHandlers: CommonHandlers;
  private readonly phoneHandlers: PhoneHandlers;
  private facebookHandlers: FacebookHandlers;
  private googleHandlers: GoogleHandlers;
  private twitchHandlers: TwitchHandlers;
  private githubHandlers: GithubHandlers;
  private slackHandlers: SlackHandlers;
  private figmaHandlers: FigmaHandlers;
  private microsoftHandlers: MicrosoftHandlers;
  private readonly _routingManager: RoutingManager;

  constructor(
    readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly emailServing: boolean,
  ) {
    this._routingManager = new RoutingManager(this.grpcSdk.router, server);
    this.localHandlers = new LocalHandlers(grpcSdk, emailServing);
    this.serviceHandler = new ServiceHandler(grpcSdk);
    this.commonHandlers = new CommonHandlers(grpcSdk);
    this.phoneHandlers = new PhoneHandlers(grpcSdk);
  }

  async registerRoutes() {
    const config = ConfigController.getInstance().config;
    let serverConfig;
    this._routingManager.clear();
    let enabled = false;
    let errorMessage = null;
    let phoneActive = await this.phoneHandlers
      .validate()
      .catch((e) => (errorMessage = e));

    if (phoneActive && !errorMessage) {
      await this.phoneHandlers.declareRoutes(this._routingManager);
    }

    let authActive = await this.localHandlers
      .validate()
      .catch((e) => (errorMessage = e));
    if (!errorMessage && authActive) {
      await this.localHandlers.declareRoutes(this._routingManager, config);
      enabled = true;
    }
    errorMessage = null;

    serverConfig = await this.grpcSdk.config.getServerConfig();
    this.facebookHandlers = new FacebookHandlers(this.grpcSdk, config, serverConfig);
    authActive = await this.facebookHandlers
      .validate()
      .catch((e) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this.facebookHandlers.declareRoutes(this._routingManager);
      enabled = true;
    }

    this.googleHandlers = new GoogleHandlers(this.grpcSdk, config, serverConfig);
    errorMessage = null;
    authActive = await this.googleHandlers
      .validate()
      .catch((e) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this.googleHandlers.declareRoutes(this._routingManager);
      enabled = true;
    }

    this.githubHandlers = new GithubHandlers(this.grpcSdk, config, serverConfig);
    errorMessage = null;
    authActive = await this.githubHandlers
      .validate()
      .catch((e) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this.githubHandlers.declareRoutes(this._routingManager);
      enabled = true;
    }

    this.slackHandlers = new SlackHandlers(this.grpcSdk, config, serverConfig);
    errorMessage = null;
    authActive = await this.slackHandlers
      .validate()
      .catch((e) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this.slackHandlers.declareRoutes(this._routingManager);
      enabled = true;
    }

    this.figmaHandlers = new FigmaHandlers(this.grpcSdk, config, serverConfig);
    errorMessage = null;
    authActive = await this.figmaHandlers
      .validate()
      .catch((e) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this.figmaHandlers.declareRoutes(this._routingManager);
      enabled = true;
    }

    this.microsoftHandlers = new MicrosoftHandlers(this.grpcSdk, config, serverConfig);
    errorMessage = null;
    authActive = await this.microsoftHandlers
      .validate()
      .catch((e) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this.microsoftHandlers.declareRoutes(this._routingManager);
      enabled = true;
    }

    errorMessage = null;
    authActive = await this.serviceHandler
      .validate()
      .catch((e) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this._routingManager.route(
        {
          path: '/service',
          action: ConduitRouteActions.POST,
          description: `Login with service account.`,
          bodyParams: {
            serviceName: ConduitString.Required,
            token: ConduitString.Required,
          },
        },
        new ConduitRouteReturnDefinition('VerifyServiceResponse', {
          serviceId: ConduitString.Required,
          accessToken: ConduitString.Required,
          refreshToken: config.generateRefreshToken ? ConduitString.Required : ConduitString.Optional,
        }),
        this.serviceHandler.authenticate.bind(this.serviceHandler),
      );

      enabled = true;
    }
    this.twitchHandlers = new TwitchHandlers(this.grpcSdk, config, serverConfig);
    errorMessage = null;
    authActive = await this.twitchHandlers
      .validate()
      .catch((e) => (errorMessage = e));
    if (!errorMessage && authActive) {
      this.twitchHandlers.declareRoutes(this._routingManager);
      enabled = true;
    }
    if (enabled) {
      this.commonHandlers.declareRoutes(this._routingManager, config);
      this._routingManager.middleware({ path: '/', name: 'authMiddleware' }, this.middleware.bind(this));
    }
    return this._routingManager.registerRoutes()
      .catch((err: Error) => {
        console.log('Failed to register routes for module');
        console.log(err);
      });
  }

  async middleware(call: ParsedRouterRequest): Promise<UnparsedRouterResponse> {
    let context = call.request.context;
    let headers = call.request.headers;

    const header = (headers['Authorization'] || headers['authorization']) as string;
    if (isNil(header)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'No authorization header present');
    }
    const args = header.split(' ');

    if (args[0] !== 'Bearer' || isNil(args[1])) {
      throw new GrpcError(status.UNAUTHENTICATED, 'Authorization header malformed');
    }

    let accessToken = await AccessToken.getInstance().findOne({
      token: args[1],
      clientId: context.clientId,
    });
    if (isNil(accessToken) || moment().isAfter(moment(accessToken.expiresOn))) {
      throw new GrpcError(
        status.UNAUTHENTICATED,
        'Token is expired or otherwise not valid',
      );
    }
    if (!accessToken.userId) {
      throw new GrpcError(
        status.UNAUTHENTICATED,
        'Token is expired or otherwise not valid',
      );
    }

    let user = await User.getInstance().findOne({
      _id: accessToken.userId,
    });
    if (isNil(user)) {
      throw new GrpcError(status.UNAUTHENTICATED, 'User no longer exists');
    }
    return { user: user };
  }
}
