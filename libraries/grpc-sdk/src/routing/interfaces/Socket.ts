import { ConduitRouteReturnDefinition } from '../ConduitRouteReturn';
import { RequestHandlers } from '../wrapRouterFunctions';
import { TYPE } from '../../interfaces';

export type ConduitSocketParamTypes = (TYPE | ConduitSocketParamTypes)[];

export interface ConduitSocketOptions {
  path: string;
  name?: string;
  description?: string;
  middlewares?: string[];
}

export interface ConduitSocketEvent {
  params?: ConduitSocketParamTypes;
  returnType?: ConduitRouteReturnDefinition;
  handler: string;
}

export interface ConduitSocketEventHandler {
  params?: ConduitSocketParamTypes;
  returnType?: ConduitRouteReturnDefinition;
  handler: RequestHandlers;
}

export interface EventsProtoDescription {
  [name: string]: {
    grpcFunction: string;
    params: string;
    returns: {
      name: string;
      fields: string;
    };
  };
}

export interface SocketProtoDescription {
  options: ConduitSocketOptions;
  // JSON stringify EventsProtoDescription
  events: string;
}

function instanceOfSocketProtoDescription(object: any): object is SocketProtoDescription {
  if (!('options' in object)) {
    return false;
  }

  return 'events' in object && object.events !== '';
}
