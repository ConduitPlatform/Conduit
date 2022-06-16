import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/commons';
import { Client } from '../../models';
import { ConduitRouteActions, ConduitRouteParameters } from '@conduitplatform/grpc-sdk';

export function getGetSecurityClientsRoute() {
  return new ConduitRoute(
    {
      path: '/security/client',
      action: ConduitRouteActions.GET,
    },
    new ConduitRouteReturnDefinition('GetSecurityClient', {
      clients: [Client.getInstance().fields],
    }),
    async (params: ConduitRouteParameters) => {
      const clients = await Client.getInstance().findMany({});
      return { result: { clients } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    },
  );
}
