import { ConduitRouteReturnDefinition } from './ConduitRouteReturn.js';
import { ConduitRouteOptions } from './Route.js';

export interface ConduitRoute {
  returnType: ConduitRouteReturnDefinition;
  input: ConduitRouteOptions;
  handler: any;
}
