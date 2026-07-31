import {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute } from '@conduitplatform/hermes';
import { ConduitString } from '@conduitplatform/module-tools';

export function getLiveRoute() {
  return new ConduitRoute(
    {
      path: '/live',
      action: ConduitRouteActions.GET,
      description: 'Shallow liveness probe — process alive, Client HTTP responding.',
    },
    new ConduitRouteReturnDefinition('Live', {
      status: ConduitString.Required,
      message: ConduitString.Required,
    }),
    async () => ({
      status: 'alive',
      message: 'Conduit Router is alive',
    }),
  );
}
