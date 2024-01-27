import { ConduitRouteActions } from './Route.js';

export interface ConduitMiddlewareOptions {
  action?: ConduitRouteActions;
  path?: string;
  name: string;
  description?: string;
}
