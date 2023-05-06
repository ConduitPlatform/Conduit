import { ConduitModel, ConduitModelField } from './Model';
import { Indexable } from './Indexable';

export interface ConduitRouteParameters {
  params?: Indexable;
  path?: string;
  headers: Indexable;
  context?: Indexable;
  cookies?: Indexable;
  bodyParams?: Indexable;
  urlParams?: Indexable;
  queryParams?: Indexable;
}

export enum RouteOptionType {
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Date = 'Date',
  ObjectId = 'ObjectId',
  JSON = 'JSON',
}

export interface ConduitRouteOptionExtended {
  type: RouteOptionType;
  required: boolean;
}

export interface ConduitRouteOption {
  [field: string]:
    | string
    | string[]
    | ConduitRouteOptionExtended
    | RouteOptionType
    | ConduitModelField
    | ConduitModelField[]
    | ConduitModel
    | ConduitModel[]
    | RouteOptionType[];
}

export enum ConduitRouteActions {
  GET = 'GET',
  POST = 'POST',
  UPDATE = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

export interface ConduitRouteOptions {
  queryParams?: ConduitRouteOption | ConduitModel;
  bodyParams?: ConduitRouteOption | ConduitModel;
  urlParams?: ConduitRouteOption | ConduitModel;
  action: ConduitRouteActions;
  path: string;
  name?: string;
  description?: string;
  middlewares?: string[];
  cacheControl?: string;
}

export interface ConduitRouteObject {
  options: ConduitRouteOptions;
  returns: {
    name: string;
    fields: string;
  };
  grpcFunction: string;
}
