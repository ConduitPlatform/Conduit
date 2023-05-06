import ConduitGrpcSdk, {
  ConduitError,
  ConduitModel,
  ConduitRouteActions,
  ConduitRouteParameters,
} from '@conduitplatform/grpc-sdk';
import { ConduitCommons } from '@conduitplatform/commons';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';
import convict from 'convict';

type SetConfig = (config: { newConfig: string }) => Promise<{ updatedConfig: string }>;
type GetModuleResponse = { setConfig: SetConfig };

export function setModuleConfigRoute(
  grpcSdk: ConduitGrpcSdk,
  commonsSdk: ConduitCommons,
  moduleName: string,
  configSchema: convict.Config<unknown>,
) {
  return new ConduitRoute(
    {
      path: `/config/${moduleName}`,
      action: ConduitRouteActions.PATCH,
      description: `Updates ${moduleName} module configuration.`,
      bodyParams: {
        config: { type: configSchema as unknown as ConduitModel, required: true },
      },
    },
    new ConduitRouteReturnDefinition(
      `Set${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}ConfigRoute`,
      {
        config: configSchema,
      },
    ),
    async (params: ConduitRouteParameters) => {
      let updatedConfig = params.params!.config;
      switch (moduleName) {
        case 'core':
          updatedConfig = await commonsSdk
            .getCore()
            .setConfig(updatedConfig)
            .catch(e => {
              throw new ConduitError(e.name, e.status ?? 500, e.message);
            });
          break;
        case 'admin':
          updatedConfig = await commonsSdk
            .getAdmin()
            .setConfig(updatedConfig)
            .catch(e => {
              throw new ConduitError(e.name, e.status ?? 500, e.message);
            });
          break;
        default:
          const moduleClient = grpcSdk.getModuleClient(
            moduleName,
          ) as unknown as GetModuleResponse;
          updatedConfig = await moduleClient
            .setConfig({
              newConfig: JSON.stringify(updatedConfig),
            })
            .catch(e => {
              throw new ConduitError(e.name, e.status ?? 500, e.message);
            });
          updatedConfig = JSON.parse(updatedConfig.updatedConfig);
      }
      await commonsSdk.getConfigManager().set(moduleName, updatedConfig);
      return { config: updatedConfig };
    },
  );
}
