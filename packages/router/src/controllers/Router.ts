import {
  ConduitCommons,
  ConduitMiddleware,
  ConduitRoute,
  ConduitRouteParameters,
} from '@conduitplatform/commons';
import { NextFunction, Request, Response, Router } from 'express';

export abstract class ConduitRouter {
  protected _expressRouter: Router;
  protected _middlewares?: { [field: string]: ConduitMiddleware };
  protected _registeredRoutes: Map<string, ConduitRoute>;
  private _refreshTimeout: NodeJS.Timeout | null = null;

  protected constructor(
    protected readonly conduitSdk: ConduitCommons,
  ) {
    this._expressRouter = Router();
    this._registeredRoutes = new Map();
  }

  protected abstract _refreshRouter(): void;

  refreshRouter() {
    this.scheduleRouterRefresh();
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

  handleRequest(req: Request, res: Response, next: NextFunction): void {
    this._expressRouter(req, res, next);
  }

  protected findInCache(hashKey: string) {
    return this.conduitSdk
      .getState()
      .getKey('hash-' + hashKey);
  }
  // age is in seconds
  protected storeInCache(hashKey: string, data: any, age: number) {
    this.conduitSdk
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
    let primaryPromise = new Promise((resolve, _) => {
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

  private scheduleRouterRefresh() {
    if (this._refreshTimeout) {
      clearTimeout(this._refreshTimeout);
      this._refreshTimeout = null;
    }
    this._refreshTimeout = setTimeout(() => {
      try {
        this._refreshRouter();
      } catch (err) {
        console.error(err);
      }
      this._refreshTimeout = null;
    }, 3000);
  }
}
