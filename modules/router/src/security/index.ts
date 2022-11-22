import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import helmet from 'helmet';
import { RateLimiter } from './handlers/rate-limiter';
import { ClientValidator } from './handlers/client-validation';
import { NextFunction, Request, Response } from 'express';
import ConduitDefaultRouter from '../Router';

export default class SecurityModule {
  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly router: ConduitDefaultRouter,
  ) {}

  setupMiddlewares() {
    const clientValidator: ClientValidator = new ClientValidator(this.grpcSdk);

    this.router.registerGlobalMiddleware(
      'rateLimiter',
      new RateLimiter(this.grpcSdk).limiter,
      true,
    );
    this.router.registerGlobalMiddleware('helmetMiddleware', helmet());
    this.router.registerGlobalMiddleware(
      'helmetGqlFix',
      (req: Request, res: Response, next: NextFunction) => {
        if (
          (req.url.startsWith('/graphql') || req.url.startsWith('/swagger')) &&
          req.method === 'GET'
        ) {
          res.removeHeader('Content-Security-Policy');
        }
        next();
      },
    );
    this.router.registerGlobalMiddleware(
      'clientMiddleware',
      clientValidator.middleware.bind(clientValidator),
      true,
    );
  }
}
