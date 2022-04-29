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
    private readonly commons: ConduitCommons,
    private readonly grpcSdk: ConduitGrpcSdk,
  ) {
    super(commons);
    this.registerSchemas().then(() => {
      return secretMigrate();
    })
      .catch(err => {
        console.error(err);
      });
    let error;
    commons
      .getConfigManager()
      .get('security')
      .catch((err: any) => (error = err));
    if (error) {
      this.commons
        .getConfigManager()
        .registerModulesConfig('security', convict.getProperties())
        .catch((e: Error) => {
          throw new Error(e.message);
        });
    } else {
      this.commons
        .getConfigManager()
        .addFieldsToModule('security', convict.getProperties())
        .catch((e: Error) => {
          throw new Error(e.message);
        });
      ;
    }
    this.grpcSdk.config.get('security')
      .then((securityConfig) => {
        if (securityConfig.active) {
          this.registerAdminRoutes();
        }
        else { console.warn('Client validation disabled')}
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
  }

  private async registerAdminRoutes() {
    this.commons.getAdmin().registerRoute(adminRoutes.getGetSecurityClientsRoute());
    this.commons.getAdmin().registerRoute(adminRoutes.getCreateSecurityClientRoute());
    this.commons.getAdmin().registerRoute(adminRoutes.getDeleteSecurityClientRoute());

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
