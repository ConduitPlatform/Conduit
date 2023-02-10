import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  GrpcError,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { status } from '@grpc/grpc-js';
import AdminModule from '../index';

export function getRouteMiddleware(admin: AdminModule) {
  return new ConduitRoute(
    {
      path: '/middlewares',
      action: ConduitRouteActions.GET,
      description: `Returns the middleware of an admin route.`,
      queryParams: {
        path: ConduitString.Required,
        action: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('GetAdminRouteMiddleware', 'String'),
    async (req: ConduitRouteParameters) => {
      const { path, action } = req.params!;
      if (!(action in ConduitRouteActions)) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid action');
      }
      const route = admin.getGrpcRoute(path, action);
      if (!route) {
        throw new GrpcError(status.NOT_FOUND, 'Route not found');
      }
      return route.options!.middlewares;
    },
  );
}
