import { ConduitRouteReturnDefinition } from './ConduitRouteReturn';
import { ConduitRouteOptions } from './Route';

export interface ConduitRoute {
  returnType: ConduitRouteReturnDefinition;
  input: ConduitRouteOptions;
  handler: any;
}
