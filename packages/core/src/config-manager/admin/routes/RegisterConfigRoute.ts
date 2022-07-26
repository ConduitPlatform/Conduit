import ConduitGrpcSdk, {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import { ConduitCommons } from '@conduitplatform/commons';
import getConfigRouteHandler from './GetConfigRouteHandler';
import setConfigRouteHandler from './SetConfigRouteHandler';

export function registerConfigRoute(
  grpcSdk: ConduitGrpcSdk,
  conduit: ConduitCommons,
  moduleName: string,
  configSchema: any,
  routeAction: ConduitRouteActions.GET | ConduitRouteActions.PATCH,
) {
  return new ConduitRoute(
    {
      path: `/config/${moduleName}`,
      action: routeAction,
      ...(routeAction === ConduitRouteActions.PATCH && {
        bodyParams: {
          config: { type: configSchema, required: true },
        },
      }),
    },
    new ConduitRouteReturnDefinition(
      routeAction === ConduitRouteActions.GET
        ? `Get${moduleName}ConfigRoute`
        : `Set${moduleName}ConfigRoute`,
      {
        config: configSchema,
      },
    ),
    async (params: ConduitRouteParameters) => {
      let response;
      routeAction === ConduitRouteActions.GET
        ? (response = await getConfigRouteHandler(grpcSdk, moduleName))
        : (response = await setConfigRouteHandler(
            params.params!.config,
            moduleName,
            grpcSdk,
            conduit,
          ));
      return response;
    },
  );
}
