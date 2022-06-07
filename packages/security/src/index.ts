import { ConduitCommons, IConduitSecurity } from '@conduitplatform/commons';
import ConduitGrpcSdk, { ConfigController } from '@conduitplatform/grpc-sdk';
import helmet from 'helmet';
import { RateLimiter } from './handlers/rate-limiter';
import { ClientValidator } from './handlers/client-validation';
import { runMigrations } from './migrations';
import * as adminRoutes from './admin/routes';
import * as models from './models';
import convict, { Config } from './config';
import { NextFunction, Request, Response } from 'express';

class SecurityModule extends IConduitSecurity {
  constructor(commons: ConduitCommons, private readonly grpcSdk: ConduitGrpcSdk) {
    super(commons);
    this.initialize()
      .then(() => {
        console.log('Security: Initialized');
      })
      .catch(err => {
        console.error('Security: Failed to initialize');
        console.error(err);
      });
  }

  async initialize() {
    await this.registerSchemas();
    await runMigrations(this.grpcSdk);
    await this.registerConfig();

    await this.registerAdminRoutes(
      ConfigController.getInstance().config.clientValidation.enabled,
    );
    this.setupMiddlewares();

    this.commons.getBus()?.subscribe('config:update:security', message => {
      try {
        ConfigController.getInstance().config = JSON.parse(message);
        this.registerAdminRoutes(
          ConfigController.getInstance().config.clientValidation.enabled,
        );
      } catch (e) {
        throw new Error(e);
      }
    });
  }

  setupMiddlewares() {
    const router = this.commons.getRouter();
    let clientValidator: ClientValidator = new ClientValidator(
      this.grpcSdk.database!,
      this.commons,
    );

    router.registerGlobalMiddleware(
      'rateLimiter',
      new RateLimiter(
        process.env.REDIS_HOST as string,
        parseInt(process.env.REDIS_PORT as string),
      ).limiter,
      true,
    );
    router.registerGlobalMiddleware('helmetMiddleware', helmet());
    router.registerGlobalMiddleware(
      'helmetGqlFix',
      (req: Request, res: Response, next: NextFunction) => {
        if (
          (req.url === '/graphql' ||
            req.url.startsWith('/swagger') ||
            req.url.startsWith('/admin/swagger')) &&
          req.method === 'GET'
        ) {
          res.removeHeader('Content-Security-Policy');
        }
        next();
      },
    );
    router.registerGlobalMiddleware(
      'clientMiddleware',
      clientValidator.middleware.bind(clientValidator),
      true,
    );
  }

  setConfig(moduleConfig: Config) {
    try {
      ConfigController.getInstance().config = moduleConfig;
      this.registerAdminRoutes(moduleConfig.clientValidation.enabled);
    } catch (e) {
      throw new Error(e);
    }
    super.setConfig(moduleConfig);
  }

  async registerConfig() {
    let error;
    let config = await this.commons
      .getConfigManager()
      .get('security')
      .catch((e: Error) => {
        error = e;
      });
    if (error) {
      await this.commons
        .getConfigManager()
        .registerModulesConfig('security', convict.getProperties());
      config = await this.commons.getConfigManager().get('security'); // fetch it again cause config is now declared
    }
    ConfigController.getInstance().config = config;
  }

  registerAdminRoutes(clientValidation: boolean) {
    if (clientValidation) {
      this.commons.getAdmin().registerRoute(adminRoutes.getGetSecurityClientsRoute());
      this.commons.getAdmin().registerRoute(adminRoutes.getCreateSecurityClientRoute());
      this.commons.getAdmin().registerRoute(adminRoutes.getDeleteSecurityClientRoute());
      console.log('Client validation enabled');
    } else {
      console.warn('Client validation disabled');
    }
  }

  private registerSchemas() {
    const promises = Object.values(models).map(model => {
      let modelInstance = model.getInstance(this.grpcSdk.database!);
      return this.grpcSdk.database!.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }
}

export = SecurityModule;
