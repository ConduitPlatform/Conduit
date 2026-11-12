import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute } from '@conduitplatform/hermes';
import { ConduitString, ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../errors.js';
import AdminModule from '../AdminModule.js';

export function getRouteMiddlewares(admin: AdminModule) {
  return new ConduitRoute(
    {
      path: '/route-middlewares',
      action: ConduitRouteActions.GET,
      description: `Returns the middleware of an admin route.`,
      queryParams: {
        path: ConduitString.Required,
        action: ConduitString.Required,
      },
      errors: [errors.INVALID_ADMIN_ROUTE_ACTION, errors.ADMIN_ROUTE_NOT_FOUND],
    },
    new ConduitRouteReturnDefinition('GetAdminRouteMiddleware', {
      middlewares: [TYPE.String],
    }),
    async (req: ConduitRouteParameters) => {
      const { path, action } = req.params!;
      if (!(action in ConduitRouteActions)) {
        throw new ModuleError(errors.INVALID_ADMIN_ROUTE_ACTION);
      }
      const { url, routeIndex } = admin.findGrpcRoute(path, action);
      const route = admin.getGrpcRoute(url, routeIndex);
      if (!route) {
        throw new ModuleError(errors.ADMIN_ROUTE_NOT_FOUND);
      }
      return { middlewares: route.options!.middlewares };
    },
  );
}
