import { ProxyRoute } from '../../classes/index.js';
import { Indexable } from '@conduitplatform/grpc-sdk';

export function isInstanceOfProxyRoute(object: Indexable): object is ProxyRoute {
  return object instanceof ProxyRoute && object.input.proxy.hasOwnProperty('target');
}
