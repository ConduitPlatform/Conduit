import { ConduitRouteActions } from './Route';

export interface ConduitMiddlewareOptions {
  action?: ConduitRouteActions;
  path?: string;
  name: string;
  description?: string;
}

export interface ConduitMiddleware {
  _input: ConduitMiddlewareOptions;
  _handler: string;
}
