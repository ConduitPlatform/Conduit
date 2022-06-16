import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/commons';
import { Client } from '../../models';
import {
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitNumber,
  ConduitString,
} from '@conduitplatform/grpc-sdk';

export function getGetSecurityClientsRoute() {
  const { clientSecret, ...returnTypeFields } = Client.getInstance().fields;
  return new ConduitRoute(
    {
      path: '/security/client',
      action: ConduitRouteActions.GET,
      queryParams: {
        skip: ConduitNumber.Optional,
        limit: ConduitNumber.Optional,
        sort: ConduitString.Optional,
      },
    },
    new ConduitRouteReturnDefinition('GetSecurityClient', {
      clients: [returnTypeFields],
    }),
    async (params: ConduitRouteParameters) => {
      const { sort } = params.params!;
      const skip = params.params!.skip ?? 0;
      const limit = params.params!.limit ?? 25;
      const clients = await Client.getInstance().findMany(
        {},
        undefined,
        skip,
        limit,
        sort,
      );
      return { result: { clients } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    },
  );
}
