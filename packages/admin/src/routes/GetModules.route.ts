import {
  ConduitCommons,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  TYPE,
} from '@conduitplatform/conduit-commons';

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
      ((conduit.getConfigManager() as any).registeredModules as Map<string, string>)
        .forEach((val: any) => {
          response.push(val);
        });
      return { result: response }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    }
  );
}
