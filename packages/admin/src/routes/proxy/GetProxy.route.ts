import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import {
  ConduitRouteActions,
  ConduitRouteParameters,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitString, ConfigController } from '@conduitplatform/module-tools';
import { AdminProxyRoute } from '../../models';

export function getProxyRoute() {
  return new ConduitRoute(
    {
      path: '/admin/proxy/:id',
      action: ConduitRouteActions.GET,
      description: `Returns a proxy route.`,
      urlParams: {
        id: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('GetProxyRoute', {
      response: TYPE.JSON,
    }),
    async (req: ConduitRouteParameters) => {
      const proxyId = req.params!.id;
      return AdminProxyRoute.getInstance().findOne({ _id: proxyId });
    },
  );
}
