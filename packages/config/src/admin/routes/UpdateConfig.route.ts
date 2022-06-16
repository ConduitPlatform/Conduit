import {
  ConduitCommons,
  ConduitRoute,
  ConduitRouteReturnDefinition,
  RegisteredModule,
} from '@conduitplatform/commons';
import ConduitGrpcSdk, {
  ConduitError,
  ConduitRouteActions,
  ConduitRouteParameters,
  RouteOptionType,
  TYPE,
} from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import * as models from '../../models';

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
      const dbConfig = await models.Config.getInstance().findOne({});
      if (isNil(dbConfig)) {
        throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
      }

      const newConfig = params.params!.config;
      const moduleName = params.params!.module;
      let updatedConfig: any;

      if (newConfig.active === false) {
        throw new ConduitError('NOT_IMPLEMENTED', 501, 'Modules cannot be deactivated');
      }

      await grpcSdk
        .initializeModules()
        .catch(() => ConduitGrpcSdk.Logger.log('Failed to refresh modules'));
      switch (moduleName) {
        case undefined:
          throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
        case 'authentication':
          if (!registeredModules.has(moduleName) || isNil(grpcSdk.authentication))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          updatedConfig = await grpcSdk.authentication.setConfig(newConfig);
          break;
        case 'forms':
          if (!registeredModules.has(moduleName) || isNil(grpcSdk.forms))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          updatedConfig = await grpcSdk.forms.setConfig(newConfig);
          break;
        case 'chat':
          if (!registeredModules.has(moduleName) || isNil(grpcSdk.chat))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          updatedConfig = await grpcSdk.chat.setConfig(newConfig);
          break;
        case 'email':
          if (!registeredModules.has(moduleName) || isNil(grpcSdk.emailProvider))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          updatedConfig = await grpcSdk.emailProvider.setConfig(newConfig);
          break;
        case 'pushNotifications':
          if (!registeredModules.has(moduleName) || isNil(grpcSdk.pushNotifications))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          updatedConfig = await grpcSdk.pushNotifications.setConfig(newConfig);
          break;
        case 'storage':
          if (!registeredModules.has(moduleName) || isNil(grpcSdk.storage))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          updatedConfig = await grpcSdk.storage.setConfig(newConfig);
          break;
        case 'sms':
          if (!registeredModules.has(moduleName) || isNil(grpcSdk.sms))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          updatedConfig = await grpcSdk.sms.setConfig(newConfig);
          break;
        case 'core':
          updatedConfig = await conduit.getConfigManager().set('core', newConfig);
          break;
        case 'router':
          updatedConfig = await conduit.getConfigManager().set('router', newConfig);
          break;
        case 'admin':
          updatedConfig = await conduit.getConfigManager().set('admin', newConfig);
          break;
        case 'security':
          updatedConfig = await conduit.getConfigManager().set('security', newConfig);
          break;
        default:
          throw new ConduitError('NOT_FOUND', 404, 'Resource not found');
      }

      return { result: { config: updatedConfig } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    },
  );
}
