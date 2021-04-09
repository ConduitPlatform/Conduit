import { TYPE } from './Model';
import { ConduitRouteReturnDefinition } from '../classes';

export type ConduitSocketParamTypes = (TYPE | ConduitSocketParamTypes)[];

export interface ConduitSocketOptions {
  path: string;
  name?: string;
  description?: string;
}

export interface ConduitSocketEvent {
  params?: ConduitSocketParamTypes;
  returnType?: ConduitRouteReturnDefinition;
  handler: string;
  // middlewares?: string[]; // TODO https://socket.io/docs/v4/middlewares/
}

export interface SocketProtoDescription {
  options: ConduitSocketOptions,
  events: {
    [name: string]: {
      grpcFunction: string,
      params: string,
      returns: {
        name: string,
        fields: string
      }
    }
  }
}

function instanceOfSocketProtoDescription(object: any): object is SocketProtoDescription {
  if (!('options' in object)) {
    return false;
  }

  if (!('events' in object)) {
    return false;
  }

  return true;
}
