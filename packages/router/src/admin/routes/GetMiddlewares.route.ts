import {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  TYPE,
} from '@conduitplatform/conduit-commons';
import { ConduitDefaultRouter } from '../../index';

export function getMiddlewares(router: ConduitDefaultRouter) {
  return new ConduitRoute(
    {
      path: '/router/middlewares',
      action: ConduitRouteActions.GET,
    },
    new ConduitRouteReturnDefinition('GetMiddlewares', {
      response: TYPE.JSON,
    }),
    async () => {
      let response: any [] = [];
      const module = router.getGrpcRoutes();
      Object.keys(module).forEach((url: string) => {
        module[url].forEach((item: any) => {
          if (item.returns == null && item.grpcFunction !== "") {
            response.push(item.grpcFunction);
          }
        });
      });
      return { result: response }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    },
  );
}
