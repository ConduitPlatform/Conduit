import { ProxyRoute } from '../../classes';

export function isInstanceOfProxyRoute(object: Object): object is ProxyRoute {
  return object instanceof ProxyRoute;
}
