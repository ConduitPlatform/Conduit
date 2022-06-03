import {
  ConduitCommons,
  ConduitRoute,
  ConduitRouteReturnDefinition,
  RegisteredModule,
} from '@conduitplatform/commons';
import { ConduitRouteActions, TYPE } from '@conduitplatform/grpc-sdk';

export function getModulesRoute(conduit: ConduitCommons) {
  return new ConduitRoute(
    {
      path: '/modules',
      action: ConduitRouteActions.GET,
    },
    new ConduitRouteReturnDefinition('GetModules', {
      response: TYPE.JSON,
    }),
    async () => {
      let response: any[] = [];
      // this is used here as such, because the config manager is simply the config package
      // TODO update the config manager interface so that we don't need these castings
      ((conduit.getConfigManager() as any).registeredModules as Map<
        string,
        RegisteredModule
      >).forEach((val: RegisteredModule) => {
        response.push(val.address);
      });
      return { result: response }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    },
  );
}
