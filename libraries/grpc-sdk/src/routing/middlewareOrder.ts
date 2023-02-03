import { ConduitRouteActions } from './interfaces';

export enum MiddlewareOrder {
  FIRST = 'FIRST',
  LAST = 'LAST',
}

export type MiddlewarePatch = {
  path: string;
  action: ConduitRouteActions;
  middlewareName: string;
  moduleName: string;
  remove: boolean;
  order?: MiddlewareOrder;
};
