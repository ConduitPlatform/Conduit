import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute } from '@conduitplatform/hermes';
import { ConduitString, ModuleError } from '@conduitplatform/module-tools';
import { errors } from '../../errors.js';
import AdminModule from '../AdminModule.js';

export function patchRouteMiddlewares(admin: AdminModule) {
  return new ConduitRoute(
    {
      path: '/patch-middleware',
      action: ConduitRouteActions.PATCH,
      description: `Patches the middleware of an admin route.`,
      queryParams: {
        path: ConduitString.Required,
        action: ConduitString.Required,
      },
      bodyParams: {
        middlewares: [ConduitString.Required],
      },
      errors: [
        errors.INVALID_ADMIN_ROUTE_ACTION,
        errors.ADMIN_ROUTE_NOT_FOUND,
        errors.ADMIN_MIDDLEWARE_PATCH_FAILED,
      ],
    },
    new ConduitRouteReturnDefinition('InjectAdminMiddleware', 'String'),
    async (req: ConduitRouteParameters) => {
      const { path, action, middlewares } = req.params!;
      if (!(action in ConduitRouteActions)) {
        throw new ModuleError(errors.INVALID_ADMIN_ROUTE_ACTION);
      }
      await admin
        ._patchRouteMiddlewares(path, action, middlewares)
        .catch(ModuleError.rethrow(errors.ADMIN_MIDDLEWARE_PATCH_FAILED));
      return 'Middleware patched successfully';
    },
  );
}
