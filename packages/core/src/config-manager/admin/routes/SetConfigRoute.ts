import ConduitGrpcSdk, {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
} from '@conduitplatform/grpc-sdk';
import { ConduitCommons } from '@conduitplatform/commons';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';

type SetConfig = (config: { newConfig: string }) => { updatedConfig: string };
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
    new ConduitRouteReturnDefinition(`Set${moduleName}ConfigRoute`, {
      config: configSchema,
    }),
    async (params: ConduitRouteParameters) => {
      let updatedConfig = params.params!.config;
      let newConfig;
      switch (moduleName) {
        case 'core':
          updatedConfig = await conduit
            .getCore()
            .setConfig(newConfig)
            .catch(e => {
              throw new ConduitError(e.name, e.status ?? 500, e.message);
            });
          break;
        case 'admin':
          updatedConfig = await conduit
            .getAdmin()
            .setConfig(newConfig)
            .catch(e => {
              throw new ConduitError(e.name, e.status ?? 500, e.message);
            });
          break;
        default:
          updatedConfig = ((await grpcSdk.getModule<any>(
            moduleName,
          )) as unknown as GetModuleResponse)!.setConfig({
            newConfig: JSON.stringify(newConfig),
          }).updatedConfig;
          updatedConfig = JSON.parse(updatedConfig);
      }
      return { result: { config: updatedConfig } };
    },
  );
}
