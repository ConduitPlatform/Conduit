import ConduitGrpcSdk, { ConfigController } from '@conduitplatform/grpc-sdk';
import helmet from 'helmet';
import { RateLimiter } from './handlers/rate-limiter';
import { ClientValidator } from './handlers/client-validation';
import { NextFunction, Request, Response } from 'express';
import ConduitDefaultRouter from '../Router';
import cors from 'cors';

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
    this.router.registerGlobalMiddleware(
      'corsMiddleware',
      (req: Request, res: Response, next: NextFunction) => {
        const config = ConfigController.getInstance().config;
        if (config.cors.enabled === false) return next();
        cors({
          origin: config.cors.origin.includes(',')
            ? config.cors.origin.split(',')
            : config.cors.origin,
          credentials: config.cors.credentials,
          methods: config.cors.methods,
          allowedHeaders: config.cors.allowedHeaders,
          exposedHeaders: config.cors.exposedHeaders,
          maxAge: config.cors.maxAge,
        })(req, res, next);
      },
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
          res.removeHeader('Cross-Origin-Embedder-Policy');
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
