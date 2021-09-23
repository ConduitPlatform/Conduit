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
  JSON = 'JSON',
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
  PATCH = 'PATCH',
  DELETE = 'DELETE',
}

export interface ConduitRouteOptions {
  queryParams?: ConduitRouteOption;
  bodyParams?: ConduitModel;
  urlParams?: ConduitRouteOption;
  action: ConduitRouteActions;
  path: string;
  name?: string;
  description?: string;
  middlewares?: string[];
  cacheControl?: string;
}

/**
 * Supports:
 * {
 *     name: 'String',
 *     age: 'Number
 *     ....
 * }
 *
 * or
 *
 * {
 *     name: {
 *         type: 'String',
 *         required: true
 *     },
 *     age: 'Number'
 * }
 *
 * or
 *
 * {
 *     user: {
 *         username: 'String',
 *         age: {
 *             type: 'Number',
 *             required: true
 *         }
 *     }
 * }
 *
 * or
 *
 * {
 *     user:{
 *         friends: ['String'],
 *         post: [{type: 'String', required:trues}]
 *     }
 * }
 *
 */
export class ConduitRouteReturnDefinition {
  private _name: string;
  private _fields: ConduitModel | string;

  constructor(name: string, fields: ConduitModel | string) {
    this._name = name;
    this._fields = fields;
  }

  get name(): string {
    return this._name;
  }

  get fields(): ConduitModel | string {
    return this._fields;
  }
}

export class ConduitRoute {
  private _returnType: ConduitRouteReturnDefinition;
  private _input: ConduitRouteOptions;
  private _handler: (request: ConduitRouteParameters) => Promise<any>;

  constructor(
    input: ConduitRouteOptions,
    type: ConduitRouteReturnDefinition,
    handler: (request: ConduitRouteParameters) => Promise<any>
  ) {
    this._input = input;
    this._returnType = type;
    this._handler = handler;
  }

  get returnTypeName(): string {
    return this._returnType.name;
  }

  get input(): ConduitRouteOptions {
    return this._input;
  }

  get returnTypeFields(): ConduitModel | string {
    return this._returnType.fields;
  }

  executeRequest(request: ConduitRouteParameters): Promise<any> {
    return this._handler(request);
  }
}
