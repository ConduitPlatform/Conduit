import { IRouterMatcher, Router } from 'express';
import { ConduitRouter } from '../Router';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { ProxyRoute, TypeRegistry } from '../classes';
import { ProxyRouteActions } from '../interfaces';

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
    const key = `${route.input.action}-${route.input.path}-${route.input.target}`;
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
    const routerMethod = this.getRouterMethod(route.input.action);
    routerMethod(route.input.path, (req, res, next) => {
      this.checkMiddlewares(req, route.input.middlewares)
        .then(() => {
          const proxyOptions = { target: route.input.target, ...route.input.options };
          return route.executeRequest(proxyOptions)(req, res, next);
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
