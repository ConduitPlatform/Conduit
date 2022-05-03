import { ConduitCommons, IConduitSecurity } from '@conduitplatform/commons';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import helmet from 'helmet';
import { RateLimiter } from './handlers/rate-limiter';
import { ClientValidator } from './handlers/client-validation';
import { secretMigrate } from './migrations/Secret.migrate';
import * as adminRoutes from './admin/routes';
import * as models from './models';
import convict from './config';

class SecurityModule extends IConduitSecurity {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    commons: ConduitCommons,
  ) {
    super(commons);
    this.registerSchemas().then(() => {
      return secretMigrate();
    })
      .catch(err => {
        console.error(err);
      });
    this.registerConfig()
      .then((config) => {
        this.registerAdminRoutes(config.clientValidation.enabled);
      })
      .catch((err) => {
        console.error(err);
      });
    const router = commons.getRouter();
    let clientValidator: ClientValidator = new ClientValidator(
      grpcSdk.database!,
      commons,
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
    router.registerGlobalMiddleware('helmetGqlFix', (req: any, res: any, next: any) => {
      if (
        (req.url === '/graphql' ||
          req.url.startsWith('/swagger') ||
          req.url.startsWith('/admin/swagger')) &&
        req.method === 'GET'
      ) {
        res.removeHeader('Content-Security-Policy');
      }
      next();
    });
    router.registerGlobalMiddleware(
      'clientMiddleware',
      clientValidator.middleware.bind(clientValidator),
      true,
    );
    commons.getBus()?.subscribe('config:update:security', (message) => {
      try {
        const config = JSON.parse(message);
        this.registerAdminRoutes(config.clientValidation.enabled);
      } catch (e) {
        throw new Error(e);
      }
    });
  }

  async registerConfig() {
    let error;
    let config = await this.commons.getConfigManager().get('security')
      .catch((e: Error) => {
        error = e;
      });
    if (error) {
      await this.commons
        .getConfigManager()
        .registerModulesConfig('security', convict.getProperties())
        .catch((e: Error) => {
          throw new Error(e.message);
        });
      config = await this.commons.getConfigManager().get('security'); // fetch it again cause config is now declared
    }
    return config;
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
    const promises = Object.values(models).map((model: any) => {
      let modelInstance = model.getInstance(this.grpcSdk.database!);
      return this.grpcSdk.database!.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }
}

export = SecurityModule;
