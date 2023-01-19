import { NextFunction, Request, Response, Router } from 'express';
import { ConduitRouter } from '../Router';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ProxyRoute, TypeRegistry } from '../classes';

export class ProxyRouteController extends ConduitRouter {
  private _proxyRoutes: Map<string, ProxyRoute>;
  private globalMiddlewares: ((
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void)[];

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
    this.globalMiddlewares = [];
    this.initializeRouter();
  }

  private initializeRouter() {
    this.createRouter();
    this._expressRouter!.use((req: Request, res: Response, next: NextFunction) => {
      this.globalMiddlewares.forEach(middleware => middleware(req, res, next));
    });
  }

  registerGlobalMiddleware(
    middleware: (req: Request, res: Response, next: NextFunction) => void,
  ) {
    this.globalMiddlewares.push(middleware);
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
    this._expressRouter!.use(route.input.path, (req, res, next) => {
      this.checkMiddlewares(req, route.input.middlewares)
        .then(r => {
          this.globalMiddlewares.forEach(middleware => middleware(req, res, next));
          createProxyMiddleware({ target: route.input.target, changeOrigin: true })(
            req,
            res,
            next,
          );
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
