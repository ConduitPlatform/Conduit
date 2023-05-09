import {
  ConduitRouteActions,
  ConduitRouteParameters,
  GrpcError,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { ConduitString } from '@conduitplatform/module-tools';
import { status } from '@grpc/grpc-js';
import AdminModule from '../index';

export function getRouteMiddlewares(admin: AdminModule) {
  return new ConduitRoute(
    {
      path: '/route-middlewares',
      action: ConduitRouteActions.GET,
      description: `Returns the pre-request middleware & post-request middleware of an admin route.`,
      queryParams: {
        path: ConduitString.Required,
        action: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('GetAdminRouteMiddleware', {
      preRequestMiddlewares: [TYPE.String],
      postRequestMiddlewares: [TYPE.String],
    }),
    async (req: ConduitRouteParameters) => {
      const { path, action } = req.params!;
      if (!(action in ConduitRouteActions)) {
        throw new GrpcError(status.INVALID_ARGUMENT, 'Invalid action');
      }
      const { url, routeIndex } = admin.findGrpcRoute(path, action);
      const route = admin.getGrpcRoute(url, routeIndex);
      if (!route) {
        throw new GrpcError(status.NOT_FOUND, 'Route not found');
      }
      return {
        preRequestMiddlewares: route.options!.middlewares,
        postRequestMiddlewares: route.options!.postRequestMiddlewares,
      };
    },
  );
}
