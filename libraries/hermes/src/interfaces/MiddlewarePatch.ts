import { ConduitRouteActions } from '@conduitplatform/grpc-sdk';

export interface MiddlewarePatch {
  path: string;
  action: ConduitRouteActions;
  middleware: string[];
}
