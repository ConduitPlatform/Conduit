import {
  ConduitRouteActions,
  ConduitRouteParameters,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { ConduitString } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import AdminModule from '../index';

export function patchMiddleware(admin: AdminModule) {
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
        middleware: [ConduitString.Required],
      },
    },
    new ConduitRouteReturnDefinition('InjectAdminMiddleware', 'String'),
    async (req: ConduitRouteParameters) => {
      const { path, action, middleware } = req.params!;
      if (!(action in ConduitRouteActions)) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid action');
      }
      await admin.internalPatchMiddleware(path, action, middleware).catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
      return 'Middleware patched successfully';
    },
  );
}
