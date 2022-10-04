import { ConduitRouteReturnDefinition } from '../ConduitRouteReturn';
import { ConduitRouteOptions } from './Route';
import { RequestHandlers } from '../wrapRouterFunctions';

export interface ConduitRoute {
  returnType: ConduitRouteReturnDefinition;
  input: ConduitRouteOptions;
  handler: RequestHandlers;
}
