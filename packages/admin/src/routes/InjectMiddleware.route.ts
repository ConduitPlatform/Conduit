import ConduitGrpcSdk, {
  ConduitNumber,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  GrpcError,
  MiddlewareOrder,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { status } from '@grpc/grpc-js';

export function injectMiddleware(grpcSdk: ConduitGrpcSdk) {
  return new ConduitRoute(
    {
      path: '/inject-middleware',
      action: ConduitRouteActions.PATCH,
      description: `Injects a middleware into an admin route with a specific order (1 = first, -1 = last).`,
      bodyParams: {
        path: ConduitString.Required,
        action: ConduitString.Required,
        middlewareName: ConduitString.Required,
        order: ConduitNumber.Required,
      },
    },
    new ConduitRouteReturnDefinition('InjectAdminMiddleware', 'String'),
    async (req: ConduitRouteParameters) => {
      const { path, action, middlewareName, order } = req.params!;
      if (!(action in ConduitRouteActions)) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid action');
      }
      if (Math.abs(order) !== 1) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Order should be 1 or -1');
      }
      const routeOrder = order === 1 ? MiddlewareOrder.FIRST : MiddlewareOrder.LAST;
      try {
        await grpcSdk.admin!.injectMiddleware(path, action, middlewareName, routeOrder);
      } catch (e) {
        throw new GrpcError(status.INTERNAL, (e as Error).message);
      }
      return 'Middleware injected successfully';
    },
  );
}
