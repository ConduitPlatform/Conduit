import {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitString,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { isNil } from 'lodash';
import { AdminProxyRoute } from '../../models';

export function updateProxyRoute() {
  return new ConduitRoute(
    {
      path: '/proxy/:id',
      action: ConduitRouteActions.UPDATE,
      description: `Updates a proxy route.`,
      urlParams: {
        id: ConduitString.Required,
      },
      bodyParams: {
        path: ConduitString.Optional,
        target: ConduitString.Optional,
        action: ConduitString.Optional,
        description: ConduitString.Optional,
        middlewares: [ConduitString.Optional],
        options: {
          type: TYPE.JSON,
          required: false,
        },
      },
    },
    new ConduitRouteReturnDefinition('UpdateProxyRoute', {
      message: ConduitString.Required,
    }),
    async (req: ConduitRouteParameters) => {
      const { id, path, target, action, description, middlewares, options } = req.params!;
      const existingProxy = await AdminProxyRoute.getInstance().findOne({ _id: id });
      if (isNil(existingProxy)) {
        throw new ConduitError('NOT_FOUND', 404, 'Proxy not found');
      }
      await AdminProxyRoute.getInstance().findByIdAndUpdate(id, {
        path,
        target,
        action,
        description,
        middlewares,
        options,
      });
      return { message: 'Proxy updated.' };
    },
  );
}
