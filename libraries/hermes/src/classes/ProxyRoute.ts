import { createProxyMiddleware } from 'http-proxy-middleware';
import { HttpProxyMiddlewareOptions, ProxyRouteOptions } from '../interfaces';
import { ConduitProxy, Indexable } from '@conduitplatform/grpc-sdk';

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
export function instanceOfConduitProxy(object: Indexable): object is ConduitProxy {
  return 'options' in object && 'path' in object.options && 'target' in object.options;
}
