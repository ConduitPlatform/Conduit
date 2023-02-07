import { createProxyMiddleware } from 'http-proxy-middleware';
import { ProxyRouteOptions } from '../interfaces';
import { Indexable } from '@conduitplatform/grpc-sdk';

export class ProxyRoute {
  private readonly _input: ProxyRouteOptions;

  constructor(input: ProxyRouteOptions) {
    this._input = input;
  }

  get input(): ProxyRouteOptions {
    return this._input;
  }

  executeRequest(proxyInput: Indexable) {
    return createProxyMiddleware(proxyInput);
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
