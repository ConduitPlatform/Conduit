import ConduitGrpcSdk, { ConduitRouteActions } from '@conduitplatform/grpc-sdk';
import { ConduitCommons } from '@conduitplatform/commons';
import getConfigRoute from './GetConfigRoute';
import setConfigRoute from './SetConfigRoute';

export function registerConfigRoute(
  grpcSdk: ConduitGrpcSdk,
  conduit: ConduitCommons,
  moduleName: string,
  configSchema: any,
  routeAction: ConduitRouteActions.GET | ConduitRouteActions.PATCH,
) {
  let response;
  routeAction === ConduitRouteActions.GET
    ? (response = getConfigRoute(grpcSdk, moduleName, configSchema))
    : (response = setConfigRoute(moduleName, grpcSdk, conduit, configSchema));
  return response;
}
