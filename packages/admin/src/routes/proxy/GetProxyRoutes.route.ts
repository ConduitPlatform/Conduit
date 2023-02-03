import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { ConduitRouteActions, TYPE } from '@conduitplatform/grpc-sdk';
import { AdminProxyRoute } from '../../models';

export function getProxyRoutesRoute() {
  return new ConduitRoute(
    {
      path: '/admin/proxy',
      action: ConduitRouteActions.GET,
      description: `Returns proxy routes.`,
    },
    new ConduitRouteReturnDefinition('GetProxyRoutes', {
      response: TYPE.JSON,
    }),
    async () => {
      return AdminProxyRoute.getInstance().findMany({});
    },
  );
}
