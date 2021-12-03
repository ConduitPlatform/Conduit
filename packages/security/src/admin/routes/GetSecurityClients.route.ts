import {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitRouteParameters,
} from '@quintessential-sft/conduit-commons';
import { Client } from '../../models';

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
      let clients = await Client.getInstance().findMany({});
      return { result: { clients } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    }
  );
}
