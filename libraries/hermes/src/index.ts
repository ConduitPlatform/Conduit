import express, { NextFunction, Request, Response, Router } from 'express';
import { RestController } from './Rest';
import { GraphQLController } from './GraphQl/GraphQL';
import { SocketController } from './Socket/Socket';
import ConduitGrpcSdk, { ConduitError } from '@conduitplatform/grpc-sdk';
import http from 'http';
import {
  ConduitRequest,
  ConduitMiddleware,
  ConduitSocket,
  SocketPush,
} from './interfaces';
import { SwaggerRouterMetadata } from './types';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { ConduitRoute } from './classes';
import { createRouteMiddleware } from './utils/logger';

export class ConduitRoutingController {
  private _restRouter?: RestController;
  private _graphQLRouter?: GraphQLController;
  private _socketRouter?: SocketController;
  private _middlewareRouter: Router;
  private readonly _cleanupTimeoutMs: number;
  private _cleanupTimeout: NodeJS.Timeout | null = null;
  readonly expressApp = express();
  readonly server = http.createServer(this.expressApp);

  constructor(
    private readonly httpPort: number,
    private readonly socketPort: number,
    private readonly baseUrl: string,
    private readonly grpcSdk: ConduitGrpcSdk,
    cleanupTimeoutMs: number = 0,
    private readonly swaggerMetadata?: SwaggerRouterMetadata,
  ) {
    this._cleanupTimeoutMs = cleanupTimeoutMs < 0 ? 0 : Math.round(cleanupTimeoutMs);
    this.start();
    this._middlewareRouter = Router();
    this._middlewareRouter.use(
      baseUrl,
      (req: Request, res: Response, next: NextFunction) => {
        next();
      },
    );

    const self = this;
    this.expressApp.use(baseUrl, (req, res, next) => {
      self._middlewareRouter(req, res, next);
    });

    this.expressApp.use(
      baseUrl,
      (err: ConduitError, req: Request, res: Response, _: NextFunction) => {
        res.status(err?.status || 500).send(err.message);
      },
    );

    this.expressApp.use(baseUrl, (req, res, next) => {
      if (req.url.startsWith('/graphql')) {
        if (!this._graphQLRouter) {
          return res
            .status(500)
            .json({ message: 'GraphQL is not enabled on this server!' });
        }
        this._graphQLRouter?.handleRequest(req, res, next);
      } else if (!req.url.startsWith('/graphql')) {
        // this needs to be a function to hook on whatever the current router is
        self._restRouter?.handleRequest(req, res, next);
      }
    });
    this.registerGlobalMiddleware();
  }

  start() {
    this.server
      .addListener('error', this.onError.bind(this))
      .addListener('listening', this.onListening.bind(this));
    this.server.listen(this.httpPort);
  }

  initRest() {
    if (this._restRouter) return;
    this._restRouter = new RestController(this.grpcSdk, this.swaggerMetadata);
  }

  initGraphQL() {
    if (this._graphQLRouter) return;
    this._graphQLRouter = new GraphQLController(this.grpcSdk);
  }

  initSockets(redisHost: string, redisPort: number) {
    if (this._socketRouter) return;
    this._socketRouter = new SocketController(
      this.socketPort,
      this.grpcSdk,
      this.expressApp,
      {
        host: redisHost,
        port: redisPort,
      },
    );
  }

  stopRest() {
    if (!this._restRouter) return;
    this._restRouter.shutDown();
    delete this._restRouter;
  }

  stopGraphQL() {
    if (!this._graphQLRouter) return;
    this._graphQLRouter.shutDown();
    delete this._graphQLRouter;
  }

  stopSockets() {
    if (!this._socketRouter) return;
    this._socketRouter.shutDown();
    delete this._socketRouter;
  }

  registerMiddleware(
    middleware: (req: ConduitRequest, res: Response, next: NextFunction) => void,
    socketMiddleware: boolean,
  ) {
    this._middlewareRouter.use(middleware);
    if (socketMiddleware) {
      this._socketRouter?.registerGlobalMiddleware(middleware);
    }
  }

  registerRouteMiddleware(middleware: ConduitMiddleware) {
    this._restRouter?.registerMiddleware(middleware);
    this._graphQLRouter?.registerMiddleware(middleware);
    this._socketRouter?.registerMiddleware(middleware);
  }

  registerRoute(
    path: string,
    router:
      | Router
      | ((req: Request, res: Response, next: NextFunction) => void)
      | ((req: Request, res: Response, next: NextFunction) => void)[],
  ) {
    this._restRouter?.registerRoute(path, router);
  }

  registerConduitRoute(route: ConduitRoute) {
    this._graphQLRouter?.registerConduitRoute(route);
    this._restRouter?.registerConduitRoute(route);
  }

  registerConduitSocket(socket: ConduitSocket) {
    this._socketRouter?.registerConduitSocket(socket);
  }

  cleanupRoutes(routes: any[]) {
    if (this._cleanupTimeoutMs === 0) {
      this._cleanupRoutes(routes);
    } else {
      if (this._cleanupTimeout) {
        clearTimeout(this._cleanupTimeout);
        this._cleanupTimeout = null;
      }
      this._cleanupTimeout = setTimeout(() => {
        try {
          this._cleanupRoutes(routes);
        } catch (err) {
          ConduitGrpcSdk.Logger.error(err as Error);
        }
        this._cleanupTimeout = null;
      }, this._cleanupTimeoutMs);
    }
  }

  private _cleanupRoutes(routes: any[]) {
    this._restRouter?.cleanupRoutes(routes);
    this._graphQLRouter?.cleanupRoutes(routes);
  }

  async socketPush(data: SocketPush) {
    await this._socketRouter?.handleSocketPush(data);
  }

  registerRoutes(
    processedRoutes: (ConduitRoute | ConduitMiddleware | ConduitSocket)[],
    url: string,
  ) {
    processedRoutes.forEach(r => {
      if (r instanceof ConduitMiddleware) {
        ConduitGrpcSdk.Logger.log(
          'New middleware registered: ' + r.input.path + ' handler url: ' + url,
        );
        this.registerRouteMiddleware(r);
      } else if (r instanceof ConduitSocket) {
        ConduitGrpcSdk.Logger.log(
          'New socket registered: ' + r.input.path + ' handler url: ' + url,
        );
        this.registerConduitSocket(r);
      } else {
        ConduitGrpcSdk.Logger.log(
          'New route registered: ' +
            r.input.action +
            ' ' +
            r.input.path +
            ' handler url: ' +
            url,
        );
        this.registerConduitRoute(r);
      }
    });
    this._restRouter?.scheduleRouterRefresh();
    this._graphQLRouter?.scheduleRouterRefresh();
  }

  onError(error: any) {
    if (error.syscall !== 'listen') {
      throw error;
    }
    const bind =
      typeof this.httpPort === 'string'
        ? 'Pipe ' + this.httpPort
        : 'Port ' + this.httpPort;
    // handle specific listen errors with friendly messages
    switch (error.code) {
      case 'EACCES':
        ConduitGrpcSdk.Logger.error(bind + ' requires elevated privileges');
        process.exit(1);
        break;
      case 'EADDRINUSE':
        ConduitGrpcSdk.Logger.error(bind + ' is already in use');
        process.exit(1);
        break;
      default:
        throw error;
    }
  }

  onListening() {
    const address = this.server.address();
    const bind =
      typeof address === 'string' ? 'pipe ' + address : 'port ' + address?.port;
    ConduitGrpcSdk.Logger.log('HTTP server listening on ' + bind);
  }

  private registerGlobalMiddleware() {
    this.registerMiddleware(cors(), false);
    this.registerMiddleware(createRouteMiddleware(ConduitGrpcSdk.Logger.winston), false);
    this.registerMiddleware(express.json({ limit: '50mb' }), false);
    this.registerMiddleware(
      express.urlencoded({ limit: '50mb', extended: false }),
      false,
    );
    this.registerMiddleware(cookieParser(), false);
    this.registerMiddleware(express.static(path.join(__dirname, 'public')), false);

    // this.registerMiddleware(
    //   (error: any, req: Request, res: Response, _: NextFunction) => {
    //     let status = error.status;
    //     if (status === null || status === undefined) status = 500;
    //     res.status(status).json({ error: error.message });
    //   },
    //   false
    // );
  }
}

export * from './interfaces';
export * from './types';
export * from './classes';
export * from './utils/GrpcConverter';
