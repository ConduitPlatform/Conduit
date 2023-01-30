import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { ConduitRouteActions, ConduitString } from '@conduitplatform/grpc-sdk';
import { ProxyRoute } from '../../models';

export function createProxyRoute() {
  return new ConduitRoute(
    {
      path: '/proxy',
      action: ConduitRouteActions.POST,
      description: `Creates a new proxy route.`,
      bodyParams: {
        path: ConduitString.Required,
        target: ConduitString.Required,
        action: ConduitString.Optional,
        description: ConduitString.Optional,
        middlewares: [ConduitString.Optional],
        // discuss  the other fields
      },
    },
    new ConduitRouteReturnDefinition('CreateProxyRoute', {
      message: ConduitString.Required,
    }),
    async req => {
      const { path, target, action, description, middlewares } = req.params!;
      // discuss the other fields
      await ProxyRoute.getInstance().create({
        path,
        target,
        action,
        description,
        middlewares,
      });

      //TODO finish this
      return { message: 'Proxy created.' };
    },
  );
}
