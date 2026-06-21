import {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute } from '@conduitplatform/hermes';
import { ConduitBoolean, ConduitString } from '@conduitplatform/module-tools';

export function getLiveRoute() {
  return new ConduitRoute(
    {
      path: '/live',
      action: ConduitRouteActions.GET,
      description: 'Shallow liveness probe — process alive, Admin HTTP responding.',
      queryParams: {
        legacy: ConduitBoolean.Optional,
      },
    },
    new ConduitRouteReturnDefinition('Live', {
      status: ConduitString.Required,
      message: ConduitString.Required,
    }),
    async () => ({
      status: 'alive',
      message: 'Conduit Core is alive',
    }),
  );
}
