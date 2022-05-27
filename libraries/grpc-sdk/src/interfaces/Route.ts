import { ConduitModel } from './Model';
import { IncomingHttpHeaders } from 'http';

export interface ConduitRouteParameters {
  params?: { [field: string]: any };
  path?: string;
  headers: IncomingHttpHeaders;
  context?: { [field: string]: any };
}

export interface StreamFileData { // used for ConduitRouteAction.FILE_UPLOAD
  file: Express.Multer.File,
}

export interface ConduitStreamRouteParameters extends ConduitRouteParameters {
  data: StreamFileData,
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
    | RouteOptionType[];
}

export enum ConduitRouteActions {
  GET = 'GET',
  POST = 'POST',
  UPDATE = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  FILE_UPLOAD = 'FILE_UPLOAD',
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

export type ConduitStreamRouteOptions = Omit<
  ConduitRouteOptions,
  'bodyParams' | 'action'
> & { action: ConduitRouteActions.FILE_UPLOAD };
