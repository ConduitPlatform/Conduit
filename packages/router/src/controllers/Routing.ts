import { Application, NextFunction, Request, Response, Router } from 'express';
import { RestController } from './Rest/Rest';
import {
  ConduitRoute,
  ConduitMiddleware,
  ConduitSocket,
  ConduitError,
} from '@conduitplatform/commons';
import { GraphQLController } from './GraphQl/GraphQL';
import { SocketController } from './Socket/Socket';
import { SocketPush } from '../models/SocketPush.model';

export class ConduitRoutingController {
  private _restRouter: RestController;
  private _graphQLRouter?: GraphQLController;
  private _socketRouter?: SocketController;
  private _app: Application;
  private _middlewareRouter: Router;

  constructor(app: Application) {
    this._app = app;
    this._restRouter = new RestController(this._app);
    this._middlewareRouter = Router();
    this._middlewareRouter.use((req: Request, res: Response, next: NextFunction) => {
      next();
    });

    const self = this;
    app.use((req, res, next) => {
      self._middlewareRouter(req, res, next);
    });

    app.use((err: ConduitError, req: Request, res: Response, next: NextFunction) => {
      res.status(err?.status || 500).send(err.message);
    });

    app.use((req, res, next) => {
      if (req.url.startsWith('/graphql') && this._graphQLRouter) {
        this._graphQLRouter.handleRequest(req, res, next);
      } else if (!req.url.startsWith('/graphql')) {
        // this needs to be a function to hook on whatever the current router is
        self._restRouter.handleRequest(req, res, next);
      }
    });
  }

  initGraphQL() {
    this._graphQLRouter = new GraphQLController(this._app);
  }

  initSockets() {
    this._socketRouter = new SocketController(this._app);
  }

  registerMiddleware(
    middleware: (req: Request, res: Response, next: NextFunction) => void,
    socketMiddleware: boolean
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
    router: Router | ((req: Request, res: Response, next: NextFunction) => void)
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
}
