import { ConduitCommons, IConduitSecurity } from '@quintessential-sft/conduit-commons';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import helmet from 'helmet';
import { RateLimiter } from './handlers/rate-limiter';
import { ClientValidator } from './handlers/client-validation';
import { secretMigrate } from './migrations/Secret.migrate';
import * as adminRoutes from './admin/routes';
import * as models from './models';

class SecurityModule extends IConduitSecurity {
  constructor(
    private readonly conduit: ConduitCommons,
    private readonly grpcSdk: ConduitGrpcSdk
  ) {
    super(conduit);
    this.registerSchemas();
    this.registerAdminRoutes();
    const router = conduit.getRouter();
    let clientValidator: ClientValidator = new ClientValidator(
      grpcSdk.databaseProvider!,
      conduit
    );

    router.registerGlobalMiddleware(
      'rateLimiter',
      new RateLimiter(
        process.env.REDIS_HOST as string,
        parseInt(process.env.REDIS_PORT as string)
      ).limiter,
      true
    );
    router.registerGlobalMiddleware('helmetMiddleware', helmet());
    router.registerGlobalMiddleware('helmetGqlFix', (req: any, res: any, next: any) => {
      if (
        (req.url === '/graphql' || req.url.startsWith('/swagger')) &&
        req.method === 'GET'
      ) {
        res.removeHeader('Content-Security-Policy');
      }
      next();
    });
    router.registerGlobalMiddleware(
      'clientMiddleware',
      clientValidator.middleware.bind(clientValidator),
      true
    );
    secretMigrate();
  }

  private registerAdminRoutes() {
    this.conduit.getAdmin().registerRoute(adminRoutes.getGetSecurityClientsRoute());
    this.conduit.getAdmin().registerRoute(adminRoutes.getCreateSecurityClientRoute());
    this.conduit.getAdmin().registerRoute(adminRoutes.getDeleteSecurityClientRoute());
  }

  private registerSchemas() {
    const promises = Object.values(models).map((model: any) => {
      let modelInstance = model.getInstance(this.grpcSdk.databaseProvider!);
      return this.grpcSdk.databaseProvider!.createSchemaFromAdapter(modelInstance);
    });
    return Promise.all(promises);
  }
}

export = SecurityModule;
