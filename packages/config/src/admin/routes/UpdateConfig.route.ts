import {
  ConduitCommons,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitRouteParameters,
  RouteOptionType,
  TYPE,
  ConduitError,
} from '@quintessential-sft/conduit-commons';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { isNil } from 'lodash';

export function getUpdateConfigRoute(grpcSdk: ConduitGrpcSdk, conduit: ConduitCommons, registeredModules: Map<string, string>) {
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
      result: { // unnested in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
        config: TYPE.JSON,
      },
    }),
    async (params: ConduitRouteParameters) => {
      const dbConfig = await grpcSdk.databaseProvider?.findOne('Config', {});
      if (isNil(dbConfig)) {
        throw new ConduitError('NOT_FOUND', 404, 'Resource not found');
      }

      const newConfig = params.params!.config;
      const moduleName = params.params!.module;
      let updatedConfig: any;

      if (newConfig.active === false)
        throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');

      await grpcSdk
        .initializeModules()
        .catch((err) => console.log('Failed to refresh modules'));
      switch (moduleName) {
        case undefined:
          throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
        case 'authentication':
          if (!registeredModules.has(moduleName) || isNil(grpcSdk.authentication))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          updatedConfig = await grpcSdk.authentication.setConfig(newConfig);
          break;
        case 'payments':
          if (!registeredModules.has(moduleName) || isNil(grpcSdk.payments))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          updatedConfig = await grpcSdk.payments.setConfig(newConfig);
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
          updatedConfig = grpcSdk.pushNotifications.setConfig(newConfig);
          break;
        case 'storage':
          if (!registeredModules.has(moduleName) || isNil(grpcSdk.storage))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          updatedConfig = grpcSdk.storage.setConfig(newConfig);
          break;
        case 'sms':
          if (!registeredModules.has(moduleName) || isNil(grpcSdk.sms))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          updatedConfig = grpcSdk.sms.setConfig(newConfig);
          break;
        case 'core':
          updatedConfig = await conduit.getConfigManager().set('core', newConfig);
          break;
        default:
          throw new ConduitError('NOT_FOUND', 404, 'Resource not found');
      }

      return { result: { config: updatedConfig } };
    }
  );
}
