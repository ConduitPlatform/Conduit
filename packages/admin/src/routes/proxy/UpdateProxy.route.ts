import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import {
  ConduitRoute,
  ConduitRouteReturnDefinition,
  ProxyRouteT,
} from '@conduitplatform/hermes';
import { isNil } from 'lodash';
import { AdminProxyRoute } from '../../models';
import AdminModule from '../../index';

export function updateProxyRoute(adminModule: AdminModule) {
  return new ConduitRoute(
    {
      path: '/admin/proxy/:id',
      action: ConduitRouteActions.UPDATE,
      description: `Updates a proxy route.`,
      urlParams: {
        id: ConduitString.Required,
      },
      bodyParams: {
        path: ConduitString.Optional,
        target: ConduitString.Optional,
        action: ConduitString.Optional,
        description: ConduitString.Optional,
        middlewares: [ConduitString.Optional],
        proxyMiddlewareOptions: {
          type: TYPE.JSON,
          required: false,
        },
      },
    },
    new ConduitRouteReturnDefinition('UpdateProxyRoute', {
      message: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const {
        id,
        path,
        target,
        action,
        description,
        middlewares,
        proxyMiddlewareOptions,
      } = req.params!;
      const existingProxy = await AdminProxyRoute.getInstance().findOne({ _id: id });
      if (isNil(existingProxy)) {
        throw new ConduitError('NOT_FOUND', 404, 'Proxy not found');
      }
      await AdminProxyRoute.getInstance().findByIdAndUpdate(id, {
        path,
        target,
        action,
        description,
        middlewares,
        proxyMiddlewareOptions,
      });
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
      adminModule.internalRegisterRoute(undefined, proxies, 'admin', 'admin');
      return { message: 'Proxy updated.' };
    },
  );
}
