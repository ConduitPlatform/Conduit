import { Application, NextFunction, Request, Response, Router } from 'express';
import { RestController } from './Rest';
import {
  ConduitCommons,
  ConduitRoute,
  ConduitMiddleware,
  ConduitSocket,
} from '@conduitplatform/commons';
import { GraphQLController } from './GraphQl/GraphQL';
import { SocketController } from './Socket/Socket';
import { SocketPush } from '../interfaces';
import { SwaggerRouterMetadata } from './Rest';
import { ConduitError } from '@conduitplatform/grpc-sdk';

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
  setExtraRouteHeaders(route: ConduitRoute, swaggerRouteDoc: any): void {
    if (route.input.middlewares?.includes('authMiddleware')) {
      swaggerRouteDoc.security[0].userToken = [];
    }
  },
};

export class ConduitRoutingController {
  private readonly _expressApp: Application;
  private readonly _commons: ConduitCommons;
  private _restRouter: RestController;
  private _graphQLRouter?: GraphQLController;
  private _socketRouter?: SocketController;
  private _middlewareRouter: Router;

  constructor(commons: ConduitCommons, expressApp: Application) {
    this._expressApp = expressApp;
    this._commons = commons;
    this._restRouter = new RestController(this._commons, swaggerRouterMetadata);
    this._middlewareRouter = Router();
    this._middlewareRouter.use((req: Request, res: Response, next: NextFunction) => {
      next();
    });

    const self = this;
    this._expressApp.use((req, res, next) => {
      self._middlewareRouter(req, res, next);
    });

    this._expressApp.use(
      (err: ConduitError, req: Request, res: Response, _: NextFunction) => {
        res.status(err?.status || 500).send(err.message);
      },
    );

    this._expressApp.use((req, res, next) => {
      if (req.url.startsWith('/graphql') && this._graphQLRouter) {
        this._graphQLRouter.handleRequest(req, res, next);
      } else if (!req.url.startsWith('/graphql')) {
        // this needs to be a function to hook on whatever the current router is
        self._restRouter.handleRequest(req, res, next);
      }
    });
  }

  initGraphQL() {
    this._graphQLRouter = new GraphQLController(this._commons);
  }

  initSockets() {
    this._socketRouter = new SocketController(this._commons, this._expressApp);
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
    this._restRouter.registerMiddleware(middleware);
    this._graphQLRouter?.registerMiddleware(middleware);
    this._socketRouter?.registerMiddleware(middleware);
  }

  registerRoute(
    path: string,
    router: Router | ((req: Request, res: Response, next: NextFunction) => void),
  ) {
    this._restRouter.registerRoute(path, router);
  }

  registerConduitRoute(route: ConduitRoute) {
    this._graphQLRouter?.registerConduitRoute(route);
    this._restRouter.registerConduitRoute(route);
  }

  registerConduitSocket(socket: ConduitSocket) {
    this._socketRouter?.registerConduitSocket(socket);
  }

  cleanupRoutes(routes: any[]) {
    this._restRouter.cleanupRoutes(routes);
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
    this._restRouter.scheduleRouterRefresh();
    this._graphQLRouter?.scheduleRouterRefresh();
  }
}
