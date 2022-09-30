import { LocalHandlers } from '../handlers/local';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConfigController,
  GrpcServer,
  RoutingManager,
  ConduitString,
} from '@conduitplatform/grpc-sdk';
import { CommonHandlers } from '../handlers/common';
import { ServiceHandler } from '../handlers/service';
import * as oauth2 from '../handlers/oauth2';
import { PhoneHandlers } from '../handlers/phone';
import { OAuth2 } from '../handlers/oauth2/OAuth2';
import { OAuth2Settings } from '../handlers/oauth2/interfaces/OAuth2Settings';
import { TwoFa } from '../handlers/twoFa';
import { TokenProvider } from '../handlers/tokenProvider';
import authMiddleware from './middleware';

type OAuthHandler = typeof oauth2;

export class AuthenticationRoutes {
  private readonly localHandlers: LocalHandlers;
  private readonly serviceHandler: ServiceHandler;
  private readonly commonHandlers: CommonHandlers;
  private readonly phoneHandlers: PhoneHandlers;
  private readonly _routingManager: RoutingManager;
  private readonly twoFaHandlers: TwoFa;

  constructor(readonly server: GrpcServer, private readonly grpcSdk: ConduitGrpcSdk) {
    this._routingManager = new RoutingManager(this.grpcSdk.router!, server);
    this.serviceHandler = new ServiceHandler(grpcSdk);
    this.commonHandlers = new CommonHandlers(grpcSdk);
    this.phoneHandlers = new PhoneHandlers(grpcSdk);
    this.localHandlers = new LocalHandlers(this.grpcSdk);
    this.twoFaHandlers = new TwoFa(this.grpcSdk);
    // initialize SDK
    TokenProvider.getInstance(grpcSdk);
  }

  async registerRoutes() {
    const config = ConfigController.getInstance().config;
    this._routingManager.clear();
    let enabled = false;
    let errorMessage = null;
    const phoneActive = await this.phoneHandlers
      .validate()
      .catch(e => (errorMessage = e));

    if (phoneActive && !errorMessage) {
      await this.phoneHandlers.declareRoutes(this._routingManager);
    }

    let authActive = await this.localHandlers.validate().catch(e => (errorMessage = e));
    if (!errorMessage && authActive) {
      await this.localHandlers.declareRoutes(this._routingManager);
      enabled = true;
    }
    errorMessage = null;
    const twoFaActive = await this.twoFaHandlers
      .validate()
      .catch(e => (errorMessage = e));
    if (!errorMessage && twoFaActive) {
      await this.twoFaHandlers.declareRoutes(this._routingManager);
      enabled = true;
    }
    errorMessage = null;

    const serverConfig: { hostUrl: string } = await this.grpcSdk.config.get('router');
    await Promise.all(
      (Object.keys(oauth2) as (keyof OAuthHandler)[]).map((key: keyof OAuthHandler) => {
        const handler: OAuth2<unknown, OAuth2Settings> = new oauth2[key](
          this.grpcSdk,
          config,
          serverConfig,
        );
        return handler
          .validate()
          .then((active: boolean) => {
            if (active) {
              handler.declareRoutes(this._routingManager);
              enabled = true;
            }
            return;
          })
          .catch(e => {
            ConduitGrpcSdk.Logger.error(e);
          });
      }),
    );

    errorMessage = null;
    authActive = await this.serviceHandler.validate().catch(e => (errorMessage = e));
    if (!errorMessage && authActive) {
      let returnField = {
        serviceId: ConduitString.Required,
        accessToken: ConduitString.Required,
      };
      if (config.generateRefreshToken) {
        returnField = Object.assign(returnField, {
          refreshToken: ConduitString.Required,
        });
      }

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
        new ConduitRouteReturnDefinition('VerifyServiceResponse', returnField),
        this.serviceHandler.authenticate.bind(this.serviceHandler),
      );

      enabled = true;
    }
    if (enabled) {
      this.commonHandlers.declareRoutes(this._routingManager);
      this._routingManager.middleware(
        { path: '/', name: 'authMiddleware' },
        authMiddleware,
      );
    }
    return this._routingManager.registerRoutes().catch((err: Error) => {
      ConduitGrpcSdk.Logger.error('Failed to register routes for module');
      ConduitGrpcSdk.Logger.error(err);
    });
  }
}
