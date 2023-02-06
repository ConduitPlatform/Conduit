import { NextFunction, Request, Response, Router } from 'express';
import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteParameters,
  GrpcError,
  Indexable,
  MiddlewarePatch,
} from '@conduitplatform/grpc-sdk';
import { ConduitMiddleware } from './interfaces';
import { ConduitRoute } from './classes';
import ObjectHash from 'object-hash';
import { status } from '@grpc/grpc-js';
import { difference } from 'lodash';

export abstract class ConduitRouter {
  protected _expressRouter?: Router;
  protected _middlewares?: { [field: string]: ConduitMiddleware };
  protected _registeredRoutes: Map<string, ConduitRoute>;
  protected _injectedMiddlewareOwners: Map<string, string>;
  private _refreshTimeout: NodeJS.Timeout | null = null;

  protected constructor(private readonly grpcSdk: ConduitGrpcSdk) {
    this._registeredRoutes = new Map();
    this._injectedMiddlewareOwners = new Map();
  }

  createRouter() {
    this._expressRouter = Router();
  }

  shutDown() {
    if (this._refreshTimeout) {
      clearTimeout(this._refreshTimeout);
    }
    if (this._expressRouter) {
      delete this._expressRouter;
    }
    if (this._middlewares) {
      delete this._middlewares;
    }
    this._registeredRoutes.clear();
  }

  protected abstract _refreshRouter(): void;

  refreshRouter() {
    this.scheduleRouterRefresh();
  }

  patchRouteMiddleware(patch: MiddlewarePatch) {
    const { path, action, middleware, moduleName } = patch;
    middleware.forEach(m => {
      if (!this._middlewares || !this._middlewares[m]) {
        throw new Error('Middleware not registered');
      }
    });
    const [key, route] = this.findRoute(path, action);
    this.validateMiddlewarePatch(route.input.middlewares!, middleware, moduleName);
    route.input.middlewares = middleware;
    this._registeredRoutes.set(key, route);
    const routes: { action: string; path: string }[] = [];
    for (const conduitRoute of this._registeredRoutes.values()) {
      routes.push({ action: conduitRoute.input.action, path: conduitRoute.input.path });
    }
    this.cleanupRoutes(routes);
  }

  cleanupRoutes(routes: { action: string; path: string }[]) {
    const newRegisteredRoutes: Map<string, ConduitRoute> = new Map();
    routes.forEach(route => {
      const key = `${route.action}-${route.path}`;
      if (this._registeredRoutes.has(key)) {
        newRegisteredRoutes.set(key, this._registeredRoutes.get(key)!);
      }
    });

    this._registeredRoutes.clear();
    this._registeredRoutes = newRegisteredRoutes;
    this.refreshRouter();
  }

  handleRequest(req: Request, res: Response, next: NextFunction): void {
    this._expressRouter!(req, res, next);
  }

  protected findInCache(hashKey: string) {
    return this.grpcSdk.state!.getKey('hash-' + hashKey);
  }

  // age is in seconds
  protected storeInCache(hashKey: string, data: Indexable, age: number) {
    this.grpcSdk.state!.setKey('hash-' + hashKey, JSON.stringify(data), age * 1000);
  }

  protected findRoute(path: string, action: ConduitRouteActions): [string, ConduitRoute] {
    const key = `${action}-${path}`;
    const exists = this._registeredRoutes.has(key);
    if (!exists) {
      throw new GrpcError(status.NOT_FOUND, 'Route not found');
    }
    return [key, this._registeredRoutes.get(key)!];
  }

  registerMiddleware(middleware: ConduitMiddleware) {
    if (!this._middlewares) {
      this._middlewares = {};
    }
    this._middlewares[middleware.name] = middleware;
  }

  checkMiddlewares(params: ConduitRouteParameters, middlewares?: string[]) {
    let primaryPromise = new Promise(resolve => {
      resolve({});
    });
    middlewares?.forEach(m => {
      if (!this._middlewares?.hasOwnProperty(m)) {
        primaryPromise = Promise.reject('Middleware does not exist');
      } else {
        primaryPromise = primaryPromise.then(r => {
          return this._middlewares![m].executeRequest.bind(this._middlewares![m])(
            params,
          ).then((p: any) => {
            if (p.result) {
              Object.assign(r as Record<string, unknown>, JSON.parse(p.result));
            }
            return r;
          });
        });
      }
    });
    return primaryPromise;
  }

  scheduleRouterRefresh() {
    if (this._refreshTimeout) {
      clearTimeout(this._refreshTimeout);
      this._refreshTimeout = null;
    }
    this._refreshTimeout = setTimeout(() => {
      try {
        this._refreshRouter();
      } catch (err) {
        ConduitGrpcSdk.Logger.error(err as Error);
      }
      this._refreshTimeout = null;
    }, 3000);
  }

  routeChanged(route: ConduitRoute) {
    const routeKey = `${route.input.action}-${route.input.path}`;
    if (this._registeredRoutes.has(routeKey)) {
      return (
        ObjectHash.sha1(route) !== ObjectHash.sha1(this._registeredRoutes.get(routeKey))
      );
    } else {
      return true;
    }
  }

  validateMiddlewarePatch(
    routeMiddleware: string[],
    patchMiddleware: string[],
    module: string,
  ) {
    const injected = patchMiddleware.filter(m => !routeMiddleware.includes(m));
    const removed = routeMiddleware.filter(m => !routeMiddleware.includes(m));
    removed.forEach(m => {
      if (this._injectedMiddlewareOwners.get(m) !== module) {
        throw new GrpcError(status.PERMISSION_DENIED, `Removal of ${m} not allowed`);
      }
    });
    for (const m of patchMiddleware) {
      if (!this._injectedMiddlewareOwners.has(m)) {
        continue;
      }
      if (
        patchMiddleware.indexOf(m) !== routeMiddleware.indexOf(m) &&
        this._injectedMiddlewareOwners.get(m) !== module
      ) {
        throw new GrpcError(
          status.PERMISSION_DENIED,
          `Not allowed to change middleware order`,
        );
      }
    }
    injected.forEach(m => this._injectedMiddlewareOwners.set(m, module));
    removed.forEach(m => this._injectedMiddlewareOwners.delete(m));
  }
}
