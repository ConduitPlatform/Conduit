import { ConduitRouteActions } from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';

export function getReadyRoute() {
  return new ConduitRoute(
    {
      path: '/ready',
      action: ConduitRouteActions.GET,
    },
    new ConduitRouteReturnDefinition(`Ready`, {}),
    async () => {
      return 'Conduit Core is online!';
    },
  );
}
