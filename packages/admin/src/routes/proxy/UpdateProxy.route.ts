import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  TYPE,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitString } from '@conduitplatform/module-tools';
import { ConduitRoute } from '@conduitplatform/hermes';
import { isNil } from 'lodash-es';
import { AdminProxyRoute } from '../../models/index.js';
import AdminModule from '../../index.js';
import { getProxies } from '../../utils/index.js';

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
        routeDescription: ConduitString.Optional,
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
        routeDescription,
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
        routeDescription: routeDescription,
        middlewares,
        proxyMiddlewareOptions,
      });
      const proxies = await getProxies();
      adminModule.internalRegisterRoute(proxies, 'admin', 'admin');
      return { message: 'Proxy updated.' };
    },
  );
}
