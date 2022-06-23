import { Router } from 'express';
import { ConduitRouteOptions } from '@conduitplatform/grpc-sdk';

export class RouteBuilder {
  private _path: string;
  private _routes: {
    get: any;
    put: any;
    post: any;
    patch: any;
    delete: any;
  };

  constructor(routePath: string) {
    this._path = routePath;
    this._routes = {
      get: null,
      put: null,
      post: null,
      patch: null,
      delete: null,
    };
  }

  get(options: ConduitRouteOptions, middleware: []): RouteBuilder {
    this._routes.get = middleware;
    return this;
  }

  post(options: ConduitRouteOptions, middleware: []): RouteBuilder {
    this._routes.post = middleware;
    return this;
  }

  put(options: ConduitRouteOptions, middleware: []): RouteBuilder {
    this._routes.put = middleware;
    return this;
  }

  patch(options: ConduitRouteOptions, middleware: []): RouteBuilder {
    this._routes.patch = middleware;
    return this;
  }

  delete(options: ConduitRouteOptions, middleware: []): RouteBuilder {
    this._routes.delete = middleware;
    return this;
  }

  construct(router: Router): void {
    if (this._routes.get) {
      router.get(this._routes.get);
    }

    if (this._routes.put) {
      router.get(this._routes.put);
    }

    if (this._routes.post) {
      router.get(this._routes.post);
    }
    if (this._routes.delete) {
      router.get(this._routes.delete);
    }

    if (this._routes.patch) {
      router.get(this._routes.patch);
    }
  }
}
