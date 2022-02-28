import {
  ConduitRoute,
  ConduitRouteActions as Actions,
  ConduitRouteReturnDefinition as ReturnDefinition,
  ConduitCommons,
  IConduitRouter,
} from '@conduitplatform/commons';
import { ConduitLogger } from './utils/logging/logger';
import { Core } from './Core';
import path from 'path';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import express, { NextFunction, Request, Response } from 'express';
import { fastify as Fastify } from 'fastify';
import FastifyExpress from 'fastify-express';

export class HttpServer {
  private _conduitSdk: ConduitCommons;
  private _initialized: boolean = false;
  private router: IConduitRouter;
  private readonly logger: ConduitLogger;
  private readonly fastify = Fastify();

  get initialized() { return this._initialized; }
  get expressApp() { return this.fastify.express; }
  set conduitSdk(conduitSdk: ConduitCommons) { this._conduitSdk = conduitSdk; }

  constructor(
    private readonly port: number | string
  ) {
    this.logger = new ConduitLogger();
  }

  async initializeFastify() {
    await this.fastify.register(FastifyExpress);
    const router = express.Router();
    this.fastify.use(router);
    this.fastify.express.disabled('x-powered-by');
  }

  postGrpcServer() {
    this.router = this._conduitSdk.getRouter();
    this.registerGlobalMiddleware();
    this.registerRoutes();
    this._initialized = true;
  }

  start() {
    this.fastify.listen(this.port);
    this.fastify.express.on('error', this.onError.bind(this));
    this.fastify.express.on('listening', this.onListening.bind(this));
  }

  private registerGlobalMiddleware() {
    this.router.registerGlobalMiddleware('cors', cors());
    this.router.registerGlobalMiddleware('logger', this.logger.middleware);
    this.router.registerGlobalMiddleware(
      'jsonParser',
      express.json({ limit: '50mb' })
    );
    this.router.registerGlobalMiddleware(
      'urlParser',
      express.urlencoded({ limit: '50mb', extended: false })
    );
    this.router.registerGlobalMiddleware('cookieParser', cookieParser());
    this.router.registerGlobalMiddleware(
      'staticResources',
      express.static(path.join(__dirname, 'public'))
    );

    this.router.registerGlobalMiddleware('errorLogger', this.logger.errorLogger);
    this.router.registerGlobalMiddleware(
      'errorCatch',
      (error: any, req: Request, res: Response, next: NextFunction) => {
        let status = error.status;
        if (status === null || status === undefined) status = 500;
        res.status(status).json({ error: error.message });
      }
    );
  }

  private registerRoutes() {
    this.router.registerRoute(
      new ConduitRoute(
        {
          path: '/',
          action: Actions.GET,
        },
        new ReturnDefinition('HelloResult', 'String'),
        async (params) => {
          return 'Hello there!';
        }
      )
    );

    this.router.registerRoute(
      new ConduitRoute(
        {
          path: '/health',
          action: Actions.GET,
          queryParams: {
            shouldCheck: 'String',
          },
        },
        new ReturnDefinition('HealthResult', 'String'),
        (params) => {
          return new Promise((resolve, reject) => {
            if (Core.getInstance().initialized) {
              resolve('Conduit is online!');
            } else {
              throw new Error('Conduit is not active yet!');
            }
          });
        }
      )
    );
  }

  onError(error: any) {
    if (error.syscall !== 'listen') {
      throw error;
    }
    const bind = typeof this.port === 'string' ? 'Pipe ' + this.port : 'Port ' + this.port;
    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        console.error(bind + ' requires elevated privileges');
        process.exit(1);
        break;
      case 'EADDRINUSE':
        console.error(bind + ' is already in use');
        process.exit(1);
        break;
      default:
        throw error;
    }
  }

  onListening() {
    const addr = this.fastify.server.address();
    const bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr?.port;
    console.log('Listening on ' + bind);
  }
}
