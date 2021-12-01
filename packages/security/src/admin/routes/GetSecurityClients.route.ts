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
      result: { // unnested in Rest.addConduitRoute, grpc routes avoid this using wrapRouterGrpcFunction
        clients: [ClientModel.fields], // TODO: Update post-convert to ConduitActiveSchema
      },
    }),
    async (params: ConduitRouteParameters) => {
      let clients = grpcSdk.databaseProvider?.findMany('Client', {});
      return { result: { clients } };
    }
  );
}
