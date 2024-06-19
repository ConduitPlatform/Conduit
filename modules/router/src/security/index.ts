import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ConfigController } from '@conduitplatform/module-tools';
import helmet from 'helmet';
import { RateLimiter } from './handlers/rate-limiter/index.js';
import { ClientValidator } from './handlers/client-validation/index.js';
import { NextFunction, Request, Response } from 'express';
import ConduitDefaultRouter from '../Router.js';
import cors from 'cors';
import { CaptchaValidator } from './handlers/captcha-validation/index.js';

export default class SecurityModule {
  private initialized = false;
  private _rateLimiter: RateLimiter | null = null;
  private _clientValidator: ClientValidator | null = null;
  private _captchaValidator: CaptchaValidator | null = null;

  constructor(
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly router: ConduitDefaultRouter,
  ) {}

  setupMiddlewares() {
    if (this.initialized) return;
    this._clientValidator = new ClientValidator(this.grpcSdk);
    this._captchaValidator = new CaptchaValidator(this.grpcSdk);
    this._rateLimiter = new RateLimiter(this.grpcSdk);

    this.router.registerGlobalMiddleware('rateLimiter', this._rateLimiter.limiter);
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
          (req.url.startsWith('/graphql') ||
            req.url.startsWith('/swagger') ||
            req.url.startsWith('/reference')) &&
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
      this._clientValidator.middleware.bind(this._clientValidator),
      true,
    );
    this.router.registerGlobalMiddleware(
      'captchaMiddleware',
      this._captchaValidator.middleware.bind(this._captchaValidator),
      false,
    );
    if (!this.initialized) this.initialized = true;
  }
}
