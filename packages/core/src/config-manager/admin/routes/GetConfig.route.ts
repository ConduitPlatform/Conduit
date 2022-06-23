import { RegisteredModule } from '@conduitplatform/commons';
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

export function getGetConfigRoute(
  grpcSdk: ConduitGrpcSdk,
  registeredModules: Map<string, RegisteredModule>,
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
      let finalConfig: any;
      const module = params.params?.module;
      if (!['core', 'admin'].includes(module)) {
        if (!registeredModules.has(module))
          throw new ConduitError('NOT_FOUND', 404, 'Resource not found');
      }
      finalConfig = await grpcSdk.state!.getKey(`moduleConfigs.${module}`);
      if (!finalConfig) {
        finalConfig = {};
      } else {
        finalConfig = JSON.parse(finalConfig);
      }
      return { result: { config: finalConfig } };
    },
  );
}
