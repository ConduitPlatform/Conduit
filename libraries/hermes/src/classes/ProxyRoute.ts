import { NextFunction, Request, Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { ProxyRouteOptions } from '../interfaces';

export class ProxyRoute {
  private readonly _input: ProxyRouteOptions;

  constructor(input: ProxyRouteOptions) {
    this._input = input;
  }

  get input(): ProxyRouteOptions {
    return this._input;
  }

  executeRequest(req: Request, res: Response, next: NextFunction) {
    createProxyMiddleware(this._input)(req, res, next);
  }
}
