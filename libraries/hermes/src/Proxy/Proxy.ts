import { NextFunction, Request, Response, Router } from 'express';
import { ConduitRouter } from '../Router';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ProxyRoute, TypeRegistry } from '../classes';

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

  registerProxyRoute(route: ProxyRoute) {
    const key = `${route.input.path}`;
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
    this._expressRouter!.use(
      route.input.path,
      createProxyMiddleware({ target: route.input.target, changeOrigin: true }),
    );
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
