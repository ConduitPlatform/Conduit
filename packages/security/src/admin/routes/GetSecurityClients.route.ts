import {
  ConduitRoute,
  ConduitRouteActions,
  ConduitRouteReturnDefinition,
  ConduitRouteParameters,
  RouteOptionType,
} from '@quintessential-sft/conduit-commons';
import ConduitGrpcSdk from '@quintessential-sft/conduit-grpc-sdk';
import { ClientModel } from '../../models/Client';

export function getGetSecurityClientsRoute(grpcSdk: ConduitGrpcSdk) {
  return new ConduitRoute(
    {
      path: '/security/client',
      action: ConduitRouteActions.GET,
    },
    new ConduitRouteReturnDefinition('GetSecurityClient', {
      clients: [ClientModel.fields], // TODO: Update post-convert to ConduitActiveSchema
    }),
    async (params: ConduitRouteParameters) => {
      let clients = await grpcSdk.databaseProvider?.findMany('Client', {});
      return { result: { clients } }; // unnested from result in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
    }
  );
}
