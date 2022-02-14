import { ConduitRouteActions } from '.';

// having all these as optional parameters is only here,
// to allow us not to change the route creation typing drasticaly
export interface ConduitMiddlewareOptions {
  action?: ConduitRouteActions;
  path?: string;
  name: string;
  description?: string;
}
