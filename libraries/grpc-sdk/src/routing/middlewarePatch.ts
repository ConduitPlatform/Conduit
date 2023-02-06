import { ConduitRouteActions } from './interfaces';

export type MiddlewarePatch = {
  path: string;
  action: ConduitRouteActions;
  middleware: string[];
  moduleName: string;
};
