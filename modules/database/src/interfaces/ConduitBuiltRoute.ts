import {
  ConduitRouteOptions,
  ConduitRouteReturnDefinition,
} from '@conduitplatform/grpc-sdk';
import { RequestHandlers } from '@conduitplatform/module-tools';

export interface ConduitBuiltRoute {
  input: ConduitRouteOptions;
  returnType: ConduitRouteReturnDefinition;
  handler: RequestHandlers;
}
