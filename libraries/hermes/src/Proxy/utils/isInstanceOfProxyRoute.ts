import { ProxyRoute } from '../../classes';
import { Indexable } from '@conduitplatform/grpc-sdk';

export function isInstanceOfProxyRoute(object: Indexable): object is ProxyRoute {
  return object instanceof ProxyRoute;
}
