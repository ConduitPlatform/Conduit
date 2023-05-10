import {
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute } from '@conduitplatform/hermes';

export function getReadyRoute() {
  return new ConduitRoute(
    {
      path: '/ready',
      action: ConduitRouteActions.GET,
    },
    new ConduitRouteReturnDefinition('Ready', 'String'),
    async () => {
      return 'Conduit Core is online!';
    },
  );
}
