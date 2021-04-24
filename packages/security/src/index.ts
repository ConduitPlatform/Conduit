import { ConduitCommons, IConduitSecurity } from '@quintessential-sft/conduit-commons';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { Admin } from './admin';
import helmet from 'helmet';
import { RateLimiter } from './handlers/rate-limiter';
import { ClientValidator } from './handlers/client-validation';

class SecurityModule extends IConduitSecurity {
  constructor(
    private readonly conduit: ConduitCommons,
    private readonly grpcSdk: ConduitGrpcSdk
  ) {
    super(conduit);

    new Admin(conduit, grpcSdk);
    const router = conduit.getRouter();

    let clientValidator: ClientValidator = new ClientValidator(
      grpcSdk.databaseProvider,
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
  }
}

export = SecurityModule;
