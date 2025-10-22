import {
  ConduitGrpcSdk,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute } from '@conduitplatform/hermes';
import convict from 'convict';

export function getModuleConfigRoute(
  grpcSdk: ConduitGrpcSdk,
  moduleName: string,
  configSchema: convict.Config<unknown>,
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
    async () => {
      let finalConfig;
      finalConfig = await grpcSdk.state!.getKey(`moduleConfigs.${moduleName}`);
      if (!finalConfig) {
        finalConfig = {};
      } else {
        finalConfig = JSON.parse(finalConfig);
      }
      return { config: finalConfig };
    },
  );
}
