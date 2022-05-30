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
import { CommonHandlers } from '../handlers/common';
import { ServiceHandler } from '../handlers/service';
import { isNil } from 'lodash';
import moment from 'moment';
import { AccessToken, User } from '../models';
import * as oauth2 from '../handlers/oauth2';
import { PhoneHandlers } from '../handlers/phone';
import { OAuth2 } from '../handlers/oauth2/OAuth2';
import { Payload } from '../handlers/oauth2/interfaces/Payload';
import { OAuth2Settings } from '../handlers/oauth2/interfaces/OAuth2Settings';

type OAuthHandler = typeof oauth2;

export class AuthenticationRoutes {
  private readonly localHandlers: LocalHandlers;
  private readonly serviceHandler: ServiceHandler;
  private readonly commonHandlers: CommonHandlers;
  private readonly phoneHandlers: PhoneHandlers;
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
    let serverConfig: { url: string };
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
    await Promise.all((Object.keys(oauth2) as (keyof OAuthHandler)[])
      .map((key: keyof OAuthHandler, value) => {
        let handler: OAuth2<Payload, OAuth2Settings> = new oauth2[key](
          this.grpcSdk,
          config,
          serverConfig,
        );
        return handler
          .validate()
          .then(() => {
            handler.declareRoutes(this._routingManager);
            enabled = true;
            return;
          })
          .catch();
      }));

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
