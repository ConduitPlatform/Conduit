import {
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

export function getGetConfigRoute(grpcSdk: ConduitGrpcSdk, registeredModules: Map<string, string>) {
  return new ConduitRoute(
    {
      path: '/config/:module',
      action: ConduitRouteActions.GET,
      urlParams: {
        module: RouteOptionType.String,
      }
    },
    new ConduitRouteReturnDefinition('GetModuleConfig', {
      result: { // unnested in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
        config: TYPE.JSON,
      },
    }),
    async (params: ConduitRouteParameters) => {
      const dbConfig = await grpcSdk.databaseProvider?.findOne('Config', {});
      if (isNil(dbConfig)) {
        return { config: {} };
      }

      let finalConfig: any;
      const module = params.params?.module;

      switch (module) {
        case undefined:
          finalConfig = dbConfig;
          delete finalConfig._id;
          delete finalConfig.createdAt;
          delete finalConfig.updatedAt;
          delete finalConfig.__v;
          break;
        case 'authentication':
          if (!registeredModules.has(module))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          finalConfig = dbConfig.moduleConfigs.authentication;
          break;
        case 'email':
          if (!registeredModules.has(module))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          finalConfig = dbConfig.moduleConfigs.email;
          break;
        case 'forms':
          if (!registeredModules.has(module))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          finalConfig = dbConfig.moduleConfigs.forms;
          break;
        case 'storage':
          if (!registeredModules.has(module))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          finalConfig = dbConfig.moduleConfigs.storage;
          break;
        case 'payments':
          if (!registeredModules.has(module))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          finalConfig = dbConfig.moduleConfigs.payments;
          break;
        case 'chat':
          if (!registeredModules.has(module))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          finalConfig = dbConfig.moduleConfigs.chat;
          break;
        case 'sms':
          if (!registeredModules.has(module))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          finalConfig = dbConfig.moduleConfigs.sms;
          break;
        case 'pushNotifications':
          if (!registeredModules.has(module))
            throw new ConduitError('INVALID_PARAMS', 400, 'Module not available');
          finalConfig = dbConfig.moduleConfigs.pushNotifications;
          break;
        case 'core':
          finalConfig = dbConfig.moduleConfigs.core;
          break;
        default:
          throw new ConduitError('NOT_FOUND', 404, 'Resource not found');
      }

      return { result: { config: finalConfig } };
    }
  );
}
