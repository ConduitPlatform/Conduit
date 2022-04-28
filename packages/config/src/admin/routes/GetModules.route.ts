import {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitError,
  ConduitString,
} from '@conduitplatform/commons';

export function getModulesRoute(servingModules: Map<string, string>) {
  return new ConduitRoute(
    {
      path: '/config/modules',
      action: ConduitRouteActions.GET,
    },
    new ConduitRouteReturnDefinition('GetModules', {
      modules: [
        {
          moduleName: ConduitString.Required,
          url: ConduitString.Required,
        },
      ],
    }),
    async () => {
      if (servingModules.size !== 0) {
        let modules: any[] = [];
        servingModules.forEach((value: string, key: string) => {
          modules.push({
            moduleName: key,
            url: value,
          });
        });
        return { result: { modules } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
      } else {
        throw new ConduitError('INVALID_ARGUMENTS', 404, 'Modules not available yet');
      }
    }
  );
}
