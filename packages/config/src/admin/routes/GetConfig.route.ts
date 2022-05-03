import {
  ConduitError,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteParameters,
  ConduitRouteReturnDefinition,
  RouteOptionType,
  TYPE,
} from '@conduitplatform/commons';
import ConduitGrpcSdk from '@conduitplatform/grpc-sdk';
import { isNil } from 'lodash';
import * as models from '../../models';

export function getGetConfigRoute(
  grpcSdk: ConduitGrpcSdk,
  registeredModules: Map<string, string>,
) {
  return new ConduitRoute(
    {
      path: '/config/:module',
      action: ConduitRouteActions.GET,
      urlParams: {
        module: RouteOptionType.String,
      },
    },
    new ConduitRouteReturnDefinition('GetModuleConfig', {
      config: TYPE.JSON,
    }),
    async (params: ConduitRouteParameters) => {

      const dbConfig = await models.Config.getInstance().findOne({});
      if (isNil(dbConfig)) {
        return { result: { config: {} } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
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
        case 'router':
          finalConfig = dbConfig.moduleConfigs.router;
          break;
        case 'admin':
          finalConfig = dbConfig.moduleConfigs.admin;
          break;
        case 'security':
          finalConfig = dbConfig.moduleConfigs.security;
          break;
        default:
          throw new ConduitError('NOT_FOUND', 404, 'Resource not found');
      }

      return { result: { config: finalConfig } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    },
  );
}
