import {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  TYPE,
} from '@conduitplatform/conduit-commons';
import { ConduitDefaultRouter } from '../../index';

export function getRoutes(router: ConduitDefaultRouter) {
  return new ConduitRoute(
    {
      path: '/routes',
      action: ConduitRouteActions.GET,
    },
    new ConduitRouteReturnDefinition('GetRoutes', {
      response: TYPE.JSON,
    }),
    async () => {
      let response: any [] = [];
      const module = router.getGrpcRoutes();
      console.log(module);
      Object.keys(module).forEach((url: string) => {
        module[url].forEach((item: any) => {
          response.push({
            name: item.grpcFunction,
            action: item.options.action,
            path: item.options.path,
          });
        });
      });
      return { result: response }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    },
  );
}
