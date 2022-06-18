import { ConduitCommons, RegisteredModule } from '@conduitplatform/commons';
import ConduitGrpcSdk, {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  RouteOptionType,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import * as models from '../../models';
import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/hermes';

export function getUpdateConfigRoute(
  grpcSdk: ConduitGrpcSdk,
  conduit: ConduitCommons,
  registeredModules: Map<string, RegisteredModule>,
) {
  return new ConduitRoute(
    {
      path: '/config/:module',
      action: ConduitRouteActions.UPDATE,
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
        case 'email':
          if (!registeredModules.has(moduleName) || isNil(grpcSdk.emailProvider))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          updatedConfig = await grpcSdk.emailProvider.setConfig(newConfig);
          break;
        case 'core':
          updatedConfig = await conduit.getConfigManager().set('core', newConfig);
          break;
        case 'admin':
          updatedConfig = await conduit.getConfigManager().set('admin', newConfig);
          break;
        default:
          if (!registeredModules.has(moduleName) || !grpcSdk.isAvailable(moduleName))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          updatedConfig = await grpcSdk.getModule<any>(moduleName)!.setConfig(newConfig);
      }
      return { result: { config: updatedConfig } };
    },
  );
}
