import { createProxyMiddleware } from 'http-proxy-middleware';
import { HttpProxyMiddlewareOptions, ProxyRouteOptions } from '../interfaces';

export class ProxyRoute {
  private readonly _input: ProxyRouteOptions;

  constructor(input: ProxyRouteOptions) {
    this._input = input;
  }

  get input(): ProxyRouteOptions {
    return this._input;
  }

  executeRequest(request: HttpProxyMiddlewareOptions) {
    return createProxyMiddleware({ ...request });
  }
}
export function instanceOfConduitProxy(route: any) {
  return (
    route &&
    route.hasOwnProperty('options') &&
    route.hasOwnProperty('proxy') &&
    typeof route.options === 'object' &&
    typeof route.proxy === 'object'
  );
}
