import { ConduitCommons, RegisteredModule } from '@conduitplatform/commons';
import ConduitGrpcSdk, {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  RouteOptionType,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';

export function getPatchConfigRoute(
  grpcSdk: ConduitGrpcSdk,
  conduit: ConduitCommons,
  registeredModules: Map<string, RegisteredModule>,
) {
  return new ConduitRoute(
    {
      path: '/config/:module',
      action: ConduitRouteActions.PATCH,
      urlParams: {
        module: { type: RouteOptionType.String, required: true },
      },
      bodyParams: {
        config: { type: TYPE.JSON, required: true },
      },
    },
    new ConduitRouteReturnDefinition('UpdateModuleConfig', {
      config: TYPE.JSON,
    }),
    async (params: ConduitRouteParameters) => {
      const newConfig = params.params!.config;
      const moduleName = params.params!.module;
      let updatedConfig: any;

      if (newConfig.active === false) {
        throw new ConduitError('NOT_IMPLEMENTED', 501, 'Modules cannot be deactivated');
      }
      switch (moduleName) {
        case 'core':
          updatedConfig = await conduit
            .getCore()
            .setConfig(newConfig)
            .catch(e => {
              throw new ConduitError(e.name, e.status, e.message);
            });
          break;
        case 'admin':
          updatedConfig = await conduit
            .getAdmin()
            .setConfig(newConfig)
            .catch(e => {
              throw new ConduitError(e.name, e.status, e.message);
            });
          break;
        default:
          if (!registeredModules.has(moduleName) || !grpcSdk.isAvailable(moduleName))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          updatedConfig = JSON.parse(
            // @ts-ignore
            (
              await grpcSdk
                .getModule<any>(moduleName)!
                // @ts-ignore
                .setConfig({ newConfig: JSON.stringify(newConfig) })
            ).updatedConfig,
          );
          // await conduit.getConfigManager().set(moduleName, updatedConfig);
          break;
      }
      await conduit.getConfigManager().set(moduleName, updatedConfig);
      return { result: { config: updatedConfig } };
    },
  );
}
