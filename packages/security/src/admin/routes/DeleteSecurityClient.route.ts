import {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitRouteParameters,
  RouteOptionType,
  ConduitString,
} from '@conduitplatform/conduit-commons';
import { Client } from '../../models';

export function getDeleteSecurityClientRoute() {
  return new ConduitRoute(
    {
      path: '/security/client/:id',
      action: ConduitRouteActions.DELETE,
      urlParams: {
        id: { type: RouteOptionType.String, required: true },
      },
    },
    new ConduitRouteReturnDefinition('DeleteSecurityClient', {
      message: ConduitString.Required,
    }),
    async (params: ConduitRouteParameters) => {
      await Client.getInstance().deleteOne({
        _id: params.params!.id,
      });
      return { result: { message: 'Client deleted' } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    }
  );
}
