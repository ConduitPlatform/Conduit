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
      message: ConduitString.Required,
    }),
    async (params: ConduitRouteParameters) => {
      await grpcSdk.databaseProvider?.deleteOne('Client', {
        _id: params.params!.id,
      });
      return { result: { message: 'Client deleted' } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    }
  );
}
