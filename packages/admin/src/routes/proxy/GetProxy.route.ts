import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ProxyRoute } from '../../models';

export function getProxyRoute() {
  return new ConduitRoute(
    {
      path: '/proxy/:id',
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
      return ProxyRoute.getInstance().findOne({ _id: proxyId });
    },
  );
}
