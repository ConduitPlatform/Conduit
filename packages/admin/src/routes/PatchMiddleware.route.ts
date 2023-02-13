import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { status } from '@grpc/grpc-js';

export function patchMiddleware(grpcSdk: ConduitGrpcSdk) {
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
      await grpcSdk.admin!.patchMiddleware(path, action, middleware).catch((e: Error) => {
        throw new GrpcError(status.INTERNAL, e.message);
      });
      return 'Middleware patched successfully';
    },
  );
}