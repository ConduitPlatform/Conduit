import ConduitGrpcSdk, { ConduitRouteActions } from '@conduitplatform/grpc-sdk';
import { ConduitCommons } from '@conduitplatform/commons';
import getModuleConfigRoute from './GetModuleConfig.route';
import setModuleConfigRoute from './SetModuleConfig.route';

export function registerModuleConfigRoute(
  grpcSdk: ConduitGrpcSdk,
  conduit: ConduitCommons,
  moduleName: string,
  configSchema: any,
  routeAction: ConduitRouteActions.GET | ConduitRouteActions.PATCH,
) {
  let response;
  routeAction === ConduitRouteActions.GET
    ? (response = getModuleConfigRoute(grpcSdk, moduleName, configSchema))
    : (response = setModuleConfigRoute(moduleName, grpcSdk, conduit, configSchema));
  return response;
}
