import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import {
  ConduitError,
  ConduitRouteActions,
  ConduitString,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { AdminProxyRoute } from '../../models';

export function createProxyRoute() {
  return new ConduitRoute(
    {
      path: '/admin/proxy',
      action: ConduitRouteActions.POST,
      description: `Creates a new proxy route.`,
      bodyParams: {
        path: ConduitString.Required,
        target: ConduitString.Required,
        action: ConduitString.Optional,
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

      return { message: 'Proxy created.' };
    },
  );
}
