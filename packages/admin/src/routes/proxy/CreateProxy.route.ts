import {
  ConduitRoute,
  ConduitRouteReturnDefinition,
  ProxyRouteT,
} from '@conduitplatform/hermes';
import {
  ConduitError,
  ConduitRouteActions,
  ConduitString,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { AdminProxyRoute } from '../../models';
import AdminModule from '../../index';

export function createProxyRoute(adminModule: AdminModule) {
  return new ConduitRoute(
    {
      path: '/admin/proxy',
      action: ConduitRouteActions.POST,
      description: `Creates a new proxy route.`,
      bodyParams: {
        path: ConduitString.Required,
        target: ConduitString.Required,
        action: ConduitString.Required,
        description: ConduitString.Optional,
        middlewares: [ConduitString.Optional],
        options: {
          type: TYPE.JSON,
          required: false,
        },
      },
    },
    new ConduitRouteReturnDefinition('CreateProxyRoute', {
      message: ConduitString.Required,
    }),
    async req => {
      const { path, target, action, description, middlewares, options } = req.params!;
      const existingRoute = await AdminProxyRoute.getInstance().findOne({ path, target });
      if (existingRoute) {
        throw ConduitError.userInput('Proxy route already exists.');
      }
      await AdminProxyRoute.getInstance().create({
        path,
        target,
        action,
        description,
        middlewares,
        options,
      });
      const proxyRoutes = await AdminProxyRoute.getInstance().findMany({});
      const proxies: ProxyRouteT[] = [];
      proxyRoutes.forEach(route => {
        proxies.push({
          options: {
            path: route.path,
            target: route.target,
            action: route.action,
            description: route.description,
            middlewares: route.middlewares,
            options: route.options,
          },
        });
      });
      adminModule.internalRegisterRoute(undefined, proxies, 'admin-package', 'admin');
      return { message: 'Proxy created.' };
    },
  );
}