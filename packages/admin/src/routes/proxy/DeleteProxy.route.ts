import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitString } from '@conduitplatform/module-tools';
import { isNil } from 'lodash';
import { ConduitRoute, ProxyRouteT } from '@conduitplatform/hermes';
import { AdminProxyRoute } from '../../models';
import AdminModule from '../../index';

export function deleteProxyRoute(adminModule: AdminModule) {
  return new ConduitRoute(
    {
      path: '/admin/proxy/:id',
      action: ConduitRouteActions.DELETE,
      description: `Deletes a proxy route.`,
      urlParams: {
        id: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('DeleteProxyRoute', {
      message: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const { id } = req.params!;
      const proxy = await AdminProxyRoute.getInstance().findOne({ _id: id });
      if (isNil(proxy)) {
        throw new ConduitError('NOT_FOUND', 404, 'Proxy not found');
      }
      await AdminProxyRoute.getInstance().deleteOne({ _id: id });
      const proxyRoutes = await AdminProxyRoute.getInstance().findMany({});
      if (proxyRoutes.length !== 0) {
        const proxies: ProxyRouteT[] = [];
        proxyRoutes.forEach(route => {
          proxies.push({
            options: {
              path: route.path,
              action: route.action,
              description: route.routeDescription,
              middlewares: route.middlewares,
            },
            proxy: {
              target: route.target,
              ...route.proxyMiddlewareOptions,
            },
          });
        });
        adminModule.internalRegisterRoute(undefined, proxies, 'admin', 'admin');
      }
      return { message: 'Proxy deleted.' };
    },
  );
}
