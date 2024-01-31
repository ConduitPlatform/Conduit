import { Router } from 'express';
import { RouteBuilder } from './RouteBuilder.js';
import { ConduitRouteOptions, UntypedArray } from '@conduitplatform/grpc-sdk';

export class RouterBuilder {
  private _path: string;
  private _middleware?: UntypedArray;
  private _router: Router;

  constructor(routePath: string, middleware?: UntypedArray) {
    this._path = routePath;
    this._router = Router();
    if (middleware) {
      this._middleware = middleware;
    }
  }

  get(path: string, options: ConduitRouteOptions, middleware: []): void {
    this._router.get(path, middleware);
  }

  post(path: string, options: ConduitRouteOptions, middleware: []): void {
    this._router.post(path, middleware);
  }

  put(path: string, options: ConduitRouteOptions, middleware: []): void {
    this._router.put(path, middleware);
  }

  patch(path: string, options: ConduitRouteOptions, middleware: []): void {
    this._router.patch(path, middleware);
  }

  delete(path: string, options: ConduitRouteOptions, middleware: []): void {
    this._router.delete(path, middleware);
  }

  route(name: string): RouteBuilder {
    return new RouteBuilder(name);
  }

  construct(): any {
    return { name: this._path, router: this._router };
  }
}
