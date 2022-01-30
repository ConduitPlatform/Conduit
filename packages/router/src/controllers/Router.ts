import {
  ConduitCommons,
  ConduitMiddleware,
  ConduitRoute,
  ConduitRouteParameters,
} from '@conduitplatform/conduit-commons';
import { Application, NextFunction, Request, Response, Router } from 'express';

export abstract class ConduitRouter {
  protected _expressRouter: Router;
  protected _middlewares?: { [field: string]: ConduitMiddleware };
  protected _registeredRoutes: Map<string, ConduitRoute>;

  constructor(protected readonly app: Application) {
    this._expressRouter = Router();
    this._registeredRoutes = new Map();
  }

  cleanupRoutes(routes: any[]) {
    let newRegisteredRoutes: Map<string, ConduitRoute> = new Map();
    routes.forEach((route: any) => {
      let key = `${route.action}-${route.path}`;
      if (this._registeredRoutes.has(key)) {
        newRegisteredRoutes.set(key, this._registeredRoutes.get(key)!);
      }
    });

    this._registeredRoutes.clear();
    this._registeredRoutes = newRegisteredRoutes;
    this.refreshRouter();
  }

  protected abstract refreshRouter(): void;

  handleRequest(req: Request, res: Response, next: NextFunction): void {
    this._expressRouter(req, res, next);
  }

  protected findInCache(hashKey: string) {
    return ((this.app as any).conduit as ConduitCommons)
      .getState()
      .getKey('hash-' + hashKey);
  }
  // age is in seconds
  protected storeInCache(hashKey: string, data: any, age: number) {
    ((this.app as any).conduit as ConduitCommons)
      .getState()
      .setKey('hash-' + hashKey, JSON.stringify(data), age * 1000);
  }

  registerMiddleware(middleware: ConduitMiddleware) {
    if (!this._middlewares) {
      this._middlewares = {};
    }
    this._middlewares[middleware.name] = middleware;
  }

  checkMiddlewares(params: ConduitRouteParameters, middlewares?: string[]): Promise<any> {
    let primaryPromise = new Promise((resolve, reject) => {
      resolve({});
    });
    const self = this;
    if (this._middlewares && middlewares) {
      middlewares.forEach((m) => {
        if (!this._middlewares?.hasOwnProperty(m))
          primaryPromise = Promise.reject('Middleware does not exist');
        primaryPromise = primaryPromise.then((r) => {
          return this._middlewares![m].executeRequest.bind(self._middlewares![m])(
            params
          ).then((p: any) => {
            if (p.result) {
              Object.assign(r, JSON.parse(p.result));
            }
            return r;
          });
        });
      });
    }

    return primaryPromise;
  }
}
