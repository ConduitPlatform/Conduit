import { ConduitRoute } from '@conduitplatform/hermes';
import {
  ConduitRouteActions,
  ConduitRouteParameters,
  TYPE,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitString } from '@conduitplatform/module-tools';
import { AdminProxyRoute } from '../../models/index.js';

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
