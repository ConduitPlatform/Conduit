import { ConduitRouteActions } from './Route';

export interface ConduitMiddlewareOptions {
  action?: ConduitRouteActions;
  path?: string;
  name: string;
  description?: string;
}
