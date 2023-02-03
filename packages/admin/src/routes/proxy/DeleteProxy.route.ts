import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { AdminProxyRoute } from '../../models';

export function deleteProxyRoute() {
  return new ConduitRoute(
    {
      path: '/admin/proxy/:id',
      action: ConduitRouteActions.DELETE,
      description: `Deletes a proxy route.`,
      urlParams: {
        id: ConduitString.Required,
      },
    },
    new ConduitRouteReturnDefinition('DeleteProxyRoute', {
      message: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const { id } = req.params!;
      const proxy = await AdminProxyRoute.getInstance().findOne({ _id: id });
      if (isNil(proxy)) {
        throw new ConduitError('NOT_FOUND', 404, 'Proxy not found');
      }
      await AdminProxyRoute.getInstance().deleteOne({ _id: id });
      return { message: 'Proxy deleted.' };
    },
  );
}
