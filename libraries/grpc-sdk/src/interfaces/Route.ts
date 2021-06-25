import { ConduitModel } from './Model';
import { IncomingHttpHeaders } from 'http';

export interface ConduitRouteParameters {
  params?: { [field: string]: any };
  path?: string;
  headers: IncomingHttpHeaders;
  context?: { [field: string]: any };
}

export enum RouteOptionType {
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Date = 'Date',
  ObjectId = 'ObjectId',
}

export interface ConduitRouteOptionExtended {
  type: RouteOptionType;
  required: boolean;
}

export interface ConduitRouteOption {
  [field: string]: string | ConduitRouteOptionExtended;
}

export enum ConduitRouteActions {
  GET = 'GET',
  POST = 'POST',
  UPDATE = 'PUT',
  DELETE = 'DELETE',
}

export interface ConduitRouteOptions {
  queryParams?: ConduitRouteOption;
  bodyParams?: ConduitModel | ConduitRouteOption;
  urlParams?: ConduitRouteOption;
  action: ConduitRouteActions;
  path: string;
  name?: string;
  description?: string;
  middlewares?: string[];
  cacheControl?: string;
}
