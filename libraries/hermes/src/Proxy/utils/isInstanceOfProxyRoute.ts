import { ProxyRoute } from '../../classes';

export function isInstanceOfProxyRoute(object: any): object is ProxyRoute {
  return object instanceof ProxyRoute;
}
