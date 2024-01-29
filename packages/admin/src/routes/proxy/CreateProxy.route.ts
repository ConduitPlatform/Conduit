import { ConduitRoute } from '@conduitplatform/hermes';
import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitString } from '@conduitplatform/module-tools';
import { AdminProxyRoute } from '../../models/index.js';
import AdminModule from '../../index.js';
import { getProxies } from '../../utils/index.js';

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
        routeDescription: ConduitString.Optional,
        middlewares: [ConduitString.Optional],
        proxyMiddlewareOptions: {
          type: TYPE.JSON,
          required: false,
        },
      },
    },
    new ConduitRouteReturnDefinition('CreateProxyRoute', {
      message: ConduitString.Required,
    }),
    async req => {
      const {
        path,
        target,
        action,
        routeDescription,
        middlewares,
        proxyMiddlewareOptions,
      } = req.params!;
      const existingRoute = await AdminProxyRoute.getInstance().findOne({ path, target });
      if (existingRoute) {
        throw ConduitError.userInput('Proxy route already exists.');
      }
      await AdminProxyRoute.getInstance().create({
        path,
        target,
        action,
        routeDescription: routeDescription,
        middlewares,
        proxyMiddlewareOptions,
      });
      const proxies = await getProxies();
      adminModule.internalRegisterRoute(proxies, 'admin', 'admin');
      return { message: 'Proxy created.' };
    },
  );
}
