import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import {
  ConduitError,
  ConduitRouteActions,
  ConduitString,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { AdminProxyRoute } from '../../models';
import AdminModule from '../../index';
import { getProxies } from '../../utils';

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
      const { path, target, action, description, middlewares, proxyMiddlewareOptions } =
        req.params!;
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
        proxyMiddlewareOptions,
      });
      const proxies = await getProxies();
      adminModule.internalRegisterRoute(undefined, proxies, 'admin', 'admin');
      return { message: 'Proxy created.' };
    },
  );
}
