import { NextFunction, Request, Response, Router } from 'express';
import { ConduitRouter } from '../Router';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { TypeRegistry } from '../classes';

export class ProxyRouteController extends ConduitRouter {
  private _proxyRoutes: Map<string, string>;

  constructor(
    grpcSdk: ConduitGrpcSdk,
    proxyBaseUrl: string,
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
  registerProxyRoute(path: string, proxyUrl: string) {
    const key = `*-${path}`;
    const registered = this._proxyRoutes.has(key);
    this._proxyRoutes.set(key, proxyUrl);
    if (registered) {
      this.refreshRouter();
    } else {
      this.addProxyRoute(path, proxyUrl);
      if (this.metrics?.registeredRoutes) {
        ConduitGrpcSdk.Metrics?.increment(this.metrics.registeredRoutes.name, 1, {
          transport: 'proxy',
        });
      }
    }
  }

  private addProxyRoute(path: string, proxyUrl: string) {
    this._expressRouter!.use(
      path,
      createProxyMiddleware({ target: proxyUrl, changeOrigin: true }),
    );
  }

  protected _refreshRouter() {
    this._expressRouter = Router();
    this._proxyRoutes.forEach((proxyUrl, path) => {
      this.addProxyRoute(path, proxyUrl);
    });
  }

  shutDown() {
    TypeRegistry.removeTransport('proxy');
    super.shutDown();
    this._proxyRoutes.clear();
  }
}
