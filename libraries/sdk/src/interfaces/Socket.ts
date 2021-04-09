import { ConduitRouteReturnDefinition } from './Route';
import { TYPE } from './Model';

export interface ConduitSocketParameters {
  event: string;
  socketId: string;
  params?: any[];
}

export type ConduitSocketParamTypes = (TYPE | ConduitSocketParamTypes)[];

export interface ConduitSocketOptions {
  path: string;
  name?: string;
  description?: string;
}

export type EventResponse = {
  event: string,
  data: any[]
  receivers?: string[]
};

export type JoinRoomResponse = {
  rooms: string[]
};

export type ConduitSocketHandlerResponse = Promise<EventResponse[] | JoinRoomResponse>;

export type ConduitSocketEventHandler = (request: ConduitSocketParameters) => ConduitSocketHandlerResponse;

export interface ConduitSocketEvent {
  name: string;
  params?: ConduitSocketParamTypes;
  returnType?: ConduitRouteReturnDefinition;
  handler: ConduitSocketEventHandler;
  // middlewares?: string[]; // TODO https://socket.io/docs/v4/middlewares/
}

export class ConduitSocket {
  private readonly _input: ConduitSocketOptions
  private readonly _events: Map<string, ConduitSocketEvent>;

  constructor(
    input: ConduitSocketOptions,
    events: Map<string, ConduitSocketEvent>
  ) {
    this._input = input;
    this._events = events;
  }

  get input(): ConduitSocketOptions {
    return this._input;
  }

  executeRequest(request: ConduitSocketParameters): ConduitSocketHandlerResponse {
    if (this._events.has(request.event)) {
      return this._events.get(request.event)!.handler(request);
    } else if (this._events.has('any')) {
      return this._events.get('any')!.handler(request);
    }
    return Promise.reject('no such event registered');
  }
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

export function instanceOfSocketProtoDescription(object: any): object is SocketProtoDescription {
  if (!('options' in object)) {
    return false;
  }

  return 'events' in object;
}
