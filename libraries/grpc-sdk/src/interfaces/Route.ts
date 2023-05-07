import { allowedTypes, ConduitModel, TYPE } from './Model';
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

type AllowedTypes = TYPE.String | TYPE.Number | TYPE.Boolean | TYPE.Date | TYPE.ObjectId;

export type ConduitUrlParam = AllowedTypes | { type: AllowedTypes; required?: boolean };
export type ConduitQueryParam =
  | ConduitUrlParam
  | AllowedTypes[]
  | { type: AllowedTypes[]; required?: boolean };

export type ConduitUrlParams = {
  [field in string]: ConduitUrlParam;
};

export type ConduitQueryParams = {
  [field in string]: ConduitQueryParam;
};

export type ConduitReturnField =
  | keyof typeof TYPE
  | TYPE
  | ConduitModel
  | {
      [key: string]: TYPE | TYPE[] | ConduitModel | ConduitModel[];
    };

export type ConduitReturnModel = {
  [field: string]: ConduitReturnField | allowedTypes | allowedTypes[] | string | string[];
};

export type ConduitReturn = ConduitReturnField | ConduitReturnModel | string;

export enum ConduitRouteActions {
  GET = 'GET',
  POST = 'POST',
  UPDATE = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

export interface ConduitRouteOptions {
  queryParams?: ConduitQueryParams;
  bodyParams?: ConduitModel;
  urlParams?: ConduitUrlParams;
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
    fields: ConduitReturn;
  };
  grpcFunction: string;
}
