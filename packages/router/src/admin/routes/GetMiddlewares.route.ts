import { ConduitRoute, ConduitRouteReturnDefinition } from '@conduitplatform/commons';
import { ConduitDefaultRouter } from '../../index';
import { isNil } from 'lodash';
import { ConduitRouteActions, TYPE } from '@conduitplatform/grpc-sdk';

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
      const response: string[] = [];
      const module = router.getGrpcRoutes();
      Object.keys(module).forEach((url: string) => {
        module[url].forEach((item: any) => {
          if (
            item.returns == null &&
            !isNil(item.grpcFunction) &&
            item.grpcFunction !== ''
          ) {
            response.push(item.grpcFunction);
          }
        });
      });
      // @ts-ignore
      const actualResponse = Array.from(new Set(response));
      return { result: actualResponse }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    },
  );
}
