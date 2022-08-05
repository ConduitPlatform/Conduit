import ConduitGrpcSdk, {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
} from '@conduitplatform/grpc-sdk';
import { ConduitCommons } from '@conduitplatform/commons';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';

type SetConfig = (config: { newConfig: string }) => Promise<{ updatedConfig: string }>;
type GetModuleResponse = { setConfig: SetConfig };

export default function setConfigRoute(
  moduleName: string,
  grpcSdk: ConduitGrpcSdk,
  conduit: ConduitCommons,
  configSchema: any,
) {
  return new ConduitRoute(
    {
      path: `/config/${moduleName}`,
      action: ConduitRouteActions.PATCH,
      bodyParams: {
        config: { type: configSchema, required: true },
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
          updatedConfig = await conduit
            .getCore()
            .setConfig(updatedConfig)
            .catch(e => {
              throw new ConduitError(e.name, e.status ?? 500, e.message);
            });
          break;
        case 'admin':
          updatedConfig = await conduit
            .getAdmin()
            .setConfig(updatedConfig)
            .catch(e => {
              throw new ConduitError(e.name, e.status ?? 500, e.message);
            });
          break;
        default:
          const moduleClient = grpcSdk.getModule<any>(
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
      await conduit.getConfigManager().set(moduleName, updatedConfig);
      return { result: { config: updatedConfig } };
    },
  );
}
