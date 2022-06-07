import {
  ConduitRouteOptions,
  ConduitRouteReturnDefinition,
  RequestHandlers,
} from '@conduitplatform/grpc-sdk';

export interface ConduitBuiltRoute {
  input: ConduitRouteOptions;
  returnType: ConduitRouteReturnDefinition;
  handler: RequestHandlers;
}
