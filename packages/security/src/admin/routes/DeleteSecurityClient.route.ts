import {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitRouteParameters,
  RouteOptionType,
  ConduitString,
} from '@quintessential-sft/conduit-commons';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';

export function getDeleteSecurityClientRoute(grpcSdk: ConduitGrpcSdk) {
  return new ConduitRoute(
    {
      path: '/security/client/:id',
      action: ConduitRouteActions.DELETE,
      urlParams: {
        id: { type: RouteOptionType.String, required: true },
      },
    },
    new ConduitRouteReturnDefinition('DeleteSecurityClient', {
      result: { // unnested in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
        message: ConduitString.Required,
      },
    }),
    async (params: ConduitRouteParameters) => {
      await grpcSdk.databaseProvider?.deleteOne('Client', {
        _id: params.params!.id,
      });
      return { message: 'Client deleted' };
    }
  );
}
