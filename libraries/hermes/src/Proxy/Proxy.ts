import { IRouterMatcher, NextFunction, Request, Response, Router } from 'express';
import { ConduitRouter } from '../Router.js';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ProxyRoute, TypeRegistry } from '../classes/index.js';
import { ProxyRouteActions } from '../interfaces/index.js';

export class ProxyRouteController extends ConduitRouter {
  private _proxyRoutes: Map<string, ProxyRoute>;
  constructor(
    grpcSdk: ConduitGrpcSdk,
    private readonly metrics?: {
      registeredRoutes?: {
        name: string;
      };
    },
  ) {
    super(grpcSdk);
    this._proxyRoutes = new Map();
    this.initializeRouter();
  }

  private initializeRouter() {
    this.createRouter();
    this._expressRouter!.use((req: Request, res: Response, next: NextFunction) => {
      next();
    });
  }

  private getRouterMethod(action: ProxyRouteActions): IRouterMatcher<Router> {
    switch (action) {
      case ProxyRouteActions.GET:
        return this._expressRouter!.get.bind(this._expressRouter);
      case ProxyRouteActions.POST:
        return this._expressRouter!.post.bind(this._expressRouter);
      case ProxyRouteActions.UPDATE:
        return this._expressRouter!.put.bind(this._expressRouter);
      case ProxyRouteActions.DELETE:
        return this._expressRouter!.delete.bind(this._expressRouter);
      case ProxyRouteActions.PATCH:
        return this._expressRouter!.patch.bind(this._expressRouter);
      case ProxyRouteActions.ALL:
      default:
        return this._expressRouter!.all.bind(this._expressRouter);
    }
  }

  registerProxyRoute(route: ProxyRoute) {
    const key = `${route.input.options.action}-${route.input.options.path}-${route.input.proxy.target}`;
    const registered = this._proxyRoutes.has(key);
    this._proxyRoutes.set(key, route);
    if (registered) {
      this.refreshRouter();
    } else {
      this.addProxyRoute(route);
      if (this.metrics?.registeredRoutes) {
        ConduitGrpcSdk.Metrics?.increment(this.metrics.registeredRoutes.name, 1, {
          transport: 'proxy',
        });
      }
    }
  }
  private addProxyRoute(route: ProxyRoute) {
    const routerMethod = this.getRouterMethod(route.input.options.action!);
    routerMethod(route.input.options.path, (req, res, next) => {
      this.checkMiddlewares(req, route.input.options.middlewares)
        .then(() => {
          return route.executeRequest(route.input.proxy)(req, res, next);
        })
        .catch(err => {
          next(err);
        });
    });
  }

  protected _refreshRouter() {
    this._expressRouter = Router();
    this._proxyRoutes.forEach(r => {
      this.addProxyRoute(r);
    });
  }

  shutDown() {
    TypeRegistry.removeTransport('proxy');
    super.shutDown();
    this._proxyRoutes.clear();
  }
}
