import ConduitGrpcSdk, {
  ConduitRouteActions,
  ConduitRouteParameters,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';

export default function getConfigRoute(
  grpcSdk: ConduitGrpcSdk,
  moduleName: string,
  configSchema: any,
) {
  return new ConduitRoute(
    {
      path: `/config/${moduleName}`,
      action: ConduitRouteActions.GET,
      description: `Returns configuration of ${moduleName} module.`,
    },
    new ConduitRouteReturnDefinition(
      `Get${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}ConfigRoute`,
      {
        config: configSchema,
      },
    ),
    async (params: ConduitRouteParameters) => {
      let finalConfig;
      finalConfig = await grpcSdk.state!.getKey(`moduleConfigs.${moduleName}`);
      if (!finalConfig) {
        finalConfig = {};
      } else {
        finalConfig = JSON.parse(finalConfig);
      }
      return { result: { config: finalConfig } };
    },
  );
}
