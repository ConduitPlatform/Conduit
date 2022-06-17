import express, { NextFunction, Request, Response, Router } from 'express';
import { RestController } from './Rest';
import { GraphQLController } from './GraphQl/GraphQL';
import { SocketController } from './Socket/Socket';
import ConduitGrpcSdk, { ConduitError, Indexable } from '@conduitplatform/grpc-sdk';
import { ConduitLogger } from './utils/logger';
import http from 'http';
import { ConduitMiddleware, ConduitSocket, SocketPush } from './interfaces';
import { SwaggerRouterMetadata } from './types';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { ConduitRoute } from './classes';

const swaggerRouterMetadata: SwaggerRouterMetadata = {
  urlPrefix: '',
  securitySchemes: {
    clientId: {
      name: 'clientid',
      type: 'apiKey',
      in: 'header',
      description: 'A security client id, retrievable through [POST] /security/client',
    },
    clientSecret: {
      name: 'clientSecret',
      type: 'apiKey',
      in: 'header',
      description:
        'A security client secret, retrievable through [POST] /security/client',
    },
    userToken: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'Bearer',
      description:
        'A user authentication token, retrievable through [POST] /authentication/local or [POST] /authentication/renew',
    },
  },
  globalSecurityHeaders: [
    {
      clientId: [],
      clientSecret: [],
    },
  ],
  setExtraRouteHeaders(route: ConduitRoute, swaggerRouteDoc: Indexable): void {
    if (route.input.middlewares?.includes('authMiddleware')) {
      swaggerRouteDoc.security[0].userToken = [];
    }
  },
};

export class ConduitRoutingController {
  private readonly _grpcSdk: ConduitGrpcSdk;
  private _restRouter?: RestController;
  private _graphQLRouter?: GraphQLController;
  private _socketRouter?: SocketController;
  private _middlewareRouter: Router;
  private readonly logger: ConduitLogger;
  readonly expressApp = express();
  readonly server = http.createServer(this.expressApp);

  constructor(
    private readonly port: number,
    private readonly baseUrl: string,
    private readonly grpcSdk: ConduitGrpcSdk,
    private readonly swaggerMetadata?: SwaggerRouterMetadata,
  ) {
    this.logger = new ConduitLogger();
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
      if (req.url.startsWith(`${baseUrl}/graphql`) && this._graphQLRouter) {
        if (!this._graphQLRouter) {
          res.status(500).json({ message: 'GraphQL is not enabled on this server!' });
        }
        this._graphQLRouter?.handleRequest(req, res, next);
      } else if (!req.url.startsWith(`${baseUrl}/graphql`)) {
        // this needs to be a function to hook on whatever the current router is
        self._restRouter?.handleRequest(req, res, next);
      }
    });
  }

  start() {
    this.server
      .addListener('error', this.onError.bind(this))
      .addListener('listening', this.onListening.bind(this));
    this.server.listen(this.port);
  }

  initRest() {
    if (this._restRouter) return;
    this._restRouter = new RestController(
      this._grpcSdk,
      this.swaggerMetadata ?? swaggerRouterMetadata,
    );
  }

  initGraphQL() {
    if (this._graphQLRouter) return;
    this._graphQLRouter = new GraphQLController(this._grpcSdk);
  }

  initSockets(redisHost: string, redisPort: number) {
    if (this._socketRouter) return;
    this._socketRouter = new SocketController(this._grpcSdk, this.expressApp, {
      host: redisHost,
      port: redisPort,
    });
  }

  stopRest() {
    // TODO implement
    throw new Error('Not Implemented yet!');
  }

  stopGraphQL() {
    // TODO implement
    throw new Error('Not Implemented yet!');
  }

  stopSockets() {
    // TODO implement
    throw new Error('Not Implemented yet!');
  }

  registerMiddleware(
    middleware: (req: Request, res: Response, next: NextFunction) => void,
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
        console.log(
          'New middleware registered: ' + r.input.path + ' handler url: ' + url,
        );
        this.registerRouteMiddleware(r);
      } else if (r instanceof ConduitSocket) {
        console.log('New socket registered: ' + r.input.path + ' handler url: ' + url);
        this.registerConduitSocket(r);
      } else {
        console.log(
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
      typeof this.port === 'string' ? 'Pipe ' + this.port : 'Port ' + this.port;
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
    const address = this.server.address();
    const bind =
      typeof address === 'string' ? 'pipe ' + address : 'port ' + address?.port;
    console.log(this.baseUrl.substr(1) + ' listening on ' + bind);
  }

  private registerGlobalMiddleware() {
    this.registerMiddleware(cors(), false);
    this.registerMiddleware(this.logger.middleware, false);
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
