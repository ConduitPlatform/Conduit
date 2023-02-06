import ConduitGrpcSdk, {
  ConduitNumber,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { status } from '@grpc/grpc-js';

export function injectMiddleware(grpcSdk: ConduitGrpcSdk) {
  return new ConduitRoute(
    {
      path: '/inject-middleware',
      action: ConduitRouteActions.PATCH,
      description: `Injects a middleware into an admin route with a specific order (1 = first, -1 = last).`,
      queryParams: {
        path: ConduitString.Required,
        action: ConduitString.Required,
      },
      bodyParams: {
        middlewareName: ConduitString.Required,
        order: ConduitNumber.Required,
      },
    },
    new ConduitRouteReturnDefinition('InjectAdminMiddleware', 'String'),
    async (req: ConduitRouteParameters) => {
      // const { path, action, middlewareName, order } = req.params!;
      // if (!(action in ConduitRouteActions)) {
      //   throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid action');
      // }
      // if (Math.abs(order) !== 1) {
      //   throw new GrpcError(status.INVALID_ARGUMENT, 'Order should be 1 or -1');
      // }
      // const middlewareOrder = order === 1 ? MiddlewareOrder.FIRST : MiddlewareOrder.LAST;
      // await grpcSdk
      //   .admin!.patchMiddleware(path, action, middlewareName, false, middlewareOrder)
      //   .catch((e: Error) => {
      //     throw new GrpcError(status.INTERNAL, e.message);
      //   });
      return 'Middleware injected successfully';
    },
  );
}
