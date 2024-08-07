import { LocalHandlers } from '../handlers/local.js';
import {
  ConduitGrpcSdk,
  ConduitReturn,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitString,
  ConfigController,
  GrpcServer,
  RoutingManager,
} from '@conduitplatform/module-tools';
import { CommonHandlers } from '../handlers/common.js';
import { ServiceHandler } from '../handlers/service.js';
import * as oauth2 from '../handlers/oauth2/index.js';
import { PhoneHandlers } from '../handlers/phone.js';
import { OAuth2 } from '../handlers/oauth2/OAuth2.js';
import { OAuth2Settings } from '../handlers/oauth2/interfaces/OAuth2Settings.js';
import { TwoFa } from '../handlers/twoFa.js';
import {
  authAnonymousMiddleware,
  authMiddleware,
  captchaMiddleware,
  denyAnonymousMiddleware,
} from './middleware.js';
import { MagicLinkHandlers } from '../handlers/magicLink.js';
import { Config } from '../config/index.js';
import { TeamsHandler } from '../handlers/team.js';
import { BiometricHandlers } from '../handlers/biometric.js';

type OAuthHandler = typeof oauth2;

export class AuthenticationRoutes {
  private readonly localHandlers: LocalHandlers;
  private readonly serviceHandler: ServiceHandler;
  private readonly commonHandlers: CommonHandlers;
  private readonly phoneHandlers: PhoneHandlers;
  private readonly _routingManager: RoutingManager;
  private readonly twoFaHandlers: TwoFa;
  private readonly magicLinkHandlers: MagicLinkHandlers;
  private readonly biometricHandlers: BiometricHandlers;

  constructor(
    readonly server: GrpcServer,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    this._routingManager = new RoutingManager(this.grpcSdk.router!, server);
    this.serviceHandler = new ServiceHandler(grpcSdk);
    this.commonHandlers = new CommonHandlers(grpcSdk);
    this.phoneHandlers = new PhoneHandlers(grpcSdk);
    this.localHandlers = new LocalHandlers(this.grpcSdk);
    this.twoFaHandlers = new TwoFa(this.grpcSdk);
    this.magicLinkHandlers = new MagicLinkHandlers(this.grpcSdk);
    this.biometricHandlers = new BiometricHandlers(this.grpcSdk);
  }

  async registerRoutes() {
    const config: Config = ConfigController.getInstance().config;
    this._routingManager.clear();
    let enabled = false;

    const phoneActive = await this.phoneHandlers
      .validate()
      .catch(e => ConduitGrpcSdk.Logger.error(e));

    if (phoneActive) {
      await this.phoneHandlers.declareRoutes(this._routingManager);
    }

    const biometricActive = await this.biometricHandlers
      .validate()
      .catch(e => ConduitGrpcSdk.Logger.error(e));

    if (biometricActive) {
      await this.biometricHandlers.declareRoutes(this._routingManager);
    }

    const magicLinkActive = await this.magicLinkHandlers
      .validate()
      .catch(e => ConduitGrpcSdk.Logger.error(e));
    if (magicLinkActive) {
      await this.magicLinkHandlers.declareRoutes(this._routingManager);
    }
    let authActive = await this.localHandlers
      .validate()
      .catch(e => ConduitGrpcSdk.Logger.error(e));
    if (authActive) {
      await this.localHandlers.declareRoutes(this._routingManager);
      enabled = true;
    }
    const teamsActivated = await TeamsHandler.getInstance(this.grpcSdk)
      .validate()
      .catch(e => ConduitGrpcSdk.Logger.error(e));
    if (teamsActivated) {
      TeamsHandler.getInstance().declareRoutes(this._routingManager);
      enabled = true;
    }
    const twoFaActive = await this.twoFaHandlers
      .validate()
      .catch(e => ConduitGrpcSdk.Logger.error(e));
    if (twoFaActive) {
      this.twoFaHandlers.declareRoutes(this._routingManager);
      enabled = true;
    }

    await Promise.all(
      (Object.keys(oauth2) as (keyof OAuthHandler)[]).map((key: keyof OAuthHandler) => {
        const handler: OAuth2<unknown, OAuth2Settings> = new oauth2[key](
          this.grpcSdk,
          config,
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

    authActive = await this.serviceHandler
      .validate()
      .catch(e => ConduitGrpcSdk.Logger.error(e));
    if (authActive) {
      const returnField: ConduitReturn = {
        serviceId: ConduitString.Required,
        accessToken: ConduitString.Optional,
        refreshToken: ConduitString.Optional,
      };

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
      this._routingManager.middleware(
        { path: '/', name: 'captchaMiddleware' },
        captchaMiddleware,
      );
      this._routingManager.middleware(
        { path: '/', name: 'authAnonymousMiddleware' },
        authAnonymousMiddleware,
      );
      this._routingManager.middleware(
        { path: '/', name: 'denyAnonymousMiddleware' },
        denyAnonymousMiddleware,
      );
    }
    return this._routingManager.registerRoutes().catch((err: Error) => {
      ConduitGrpcSdk.Logger.error('Failed to register routes for module');
      ConduitGrpcSdk.Logger.error(err);
    });
  }
}
