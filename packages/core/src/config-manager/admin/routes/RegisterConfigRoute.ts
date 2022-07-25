import ConduitGrpcSdk, {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';

export function registerConfigRoute(
  grpcSdk: ConduitGrpcSdk,
  moduleName: string,
  configSchema: any,
  routeAction: ConduitRouteActions.GET | ConduitRouteActions.PATCH,
) {
  return new ConduitRoute(
    {
      path: `/config/${moduleName}`,
      action: routeAction,
      bodyParams: {
        config: { type: configSchema, required: true },
      },
    },
    new ConduitRouteReturnDefinition(
      routeAction === ConduitRouteActions.GET ? 'GetConfigRoute' : 'SetConfigRoute',
      {
        config: configSchema,
      },
    ),
    async (params: ConduitRouteParameters) => {
      const newConfig = params.params!.config;
      const updatedConfig = JSON.parse(
        // @ts-ignore
        (
          await grpcSdk
            .getModule<any>(moduleName)!
            // @ts-ignore
            .setConfig({ newConfig: JSON.stringify(newConfig) })
        ).updatedConfig,
      );
      return { result: { config: updatedConfig } };
    },
  );
}
