import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { status } from '@grpc/grpc-js';

export function removeMiddleware(grpcSdk: ConduitGrpcSdk) {
  return new ConduitRoute(
    {
      path: '/remove-middleware',
      action: ConduitRouteActions.PATCH,
      description: `Removes a patched middleware from an admin route.`,
      queryParams: {
        path: ConduitString.Required,
        action: ConduitString.Required,
        middlewareName: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('RemoveAdminMiddleware', 'String'),
    async (req: ConduitRouteParameters) => {
      const { path, action, middlewareName } = req.params!;
      if (!(action in ConduitRouteActions)) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid action');
      }
      await grpcSdk
        .admin!.patchMiddleware(path, action, middlewareName, true)
        .catch((e: Error) => {
          throw new GrpcError(status.INTERNAL, e.message);
        });
      return 'Middleware removed successfully';
    },
  );
}
