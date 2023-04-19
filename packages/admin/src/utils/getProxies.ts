import { ProxyRouteT } from '@conduitplatform/hermes';
import { AdminProxyRoute } from '../models';

export async function getProxies(): Promise<ProxyRouteT[]> {
  const proxyRoutes = await AdminProxyRoute.getInstance().findMany({});
  const proxies: ProxyRouteT[] = [];
  proxyRoutes.forEach(route => {
    proxies.push({
      options: {
        path: route.path,
        action: route.action,
        description: route.description,
        middlewares: route.middlewares,
      },
      proxy: {
        target: route.target,
        ...route.proxyMiddlewareOptions,
      },
    });
  });
  return proxies;
}