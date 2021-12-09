import {
  ConduitCommons,
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  TYPE,
} from '@quintessential-sft/conduit-commons';

export function getRoutes(conduit: ConduitCommons) {
  return new ConduitRoute(
    {
      path: '/routes',
      action: ConduitRouteActions.GET,
    },
    new ConduitRouteReturnDefinition('GetRoutes', {
      response: TYPE.JSON,
    }),
    async () => {
      let response:any [] = [];
      conduit.getAdmin().registeredRoutes.forEach( (route : any ) => {
        response.push({
          name: route._returnType.name,
          action: route._input.action,
          path: route._input.path,
        })
      })
      return { result: response }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    },
  );
}
