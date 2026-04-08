import { allowedTypes, ConduitModel, ConduitValidationRules, TYPE } from './Model.js';
import { Indexable } from './Indexable.js';

export interface ModuleErrorDefinition {
  grpcCode: number;
  conduitCode: string;
  message: string;
  description: string;
}

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

export type ConduitUrlParam =
  | AllowedTypes
  | { type: AllowedTypes; required?: boolean; validate?: ConduitValidationRules };
export type ConduitQueryParam =
  | ConduitUrlParam
  | AllowedTypes[]
  | { type: AllowedTypes[]; required: boolean; validate?: ConduitValidationRules }
  | { type: AllowedTypes; required?: boolean; validate?: ConduitValidationRules }[];

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

export interface RateLimitOptions {
  maxRequests: number;
  /** Window length in seconds */
  resetInterval: number;
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
  mcp?: boolean;
  errors?: ModuleErrorDefinition[];
  /**
   * How unknown body/query/url keys are handled during Zod validation:
   * - `true`: reject with USER_INPUT_ERROR (strict mode)
   * - `false`: allow through to the handler (passthrough)
   * - unset: strip unknown keys from validated params (default; prevents pollution without errors)
   */
  strictParams?: boolean;
  /** Per-route rate limit (per client IP). Fails closed if Redis is unavailable. */
  rateLimit?: RateLimitOptions;
}

export interface ConduitRouteObject {
  options: ConduitRouteOptions;
  returns: {
    name: string;
    fields: ConduitReturn;
  };
  grpcFunction: string;
}
