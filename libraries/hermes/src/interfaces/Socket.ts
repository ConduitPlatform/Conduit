import {
  ConduitRouteReturnDefinition,
  Indexable,
  TYPE,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';

export interface ConduitSocketParameters {
  event: string;
  socketId: string;
  params?: UntypedArray;
  context?: Indexable;
}

export type ConduitSocketParamTypes = (TYPE | ConduitSocketParamTypes)[];

export interface ConduitSocketOptions {
  path: string;
  name?: string;
  description?: string;
  middlewares?: string[];
}

export type EventResponse = {
  event: string;
  data: string;
  receivers?: string[];
};

export function isInstanceOfEventResponse(object: Indexable): object is EventResponse {
  if (!('receivers' in object)) return false;
  if (!('data' in object)) return false;

  return 'event' in object && object.event !== '';
}

export type JoinRoomResponse = {
  rooms: string[];
};

export type ConduitSocketHandlerResponse = Promise<EventResponse | JoinRoomResponse>;

export type ConduitSocketEventHandler = (
  request: ConduitSocketParameters,
) => ConduitSocketHandlerResponse;

export interface ConduitSocketEvent {
  name: string;
  params?: ConduitSocketParamTypes;
  returnType?: ConduitRouteReturnDefinition;
  handler: ConduitSocketEventHandler;
}

export class ConduitSocket {
  private readonly _input: ConduitSocketOptions;
  private readonly _events: Map<string, ConduitSocketEvent>;

  constructor(input: ConduitSocketOptions, events: Map<string, ConduitSocketEvent>) {
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

export function instanceOfSocketProtoDescription(
  object: Indexable,
): object is SocketProtoDescription {
  if (!('options' in object)) {
    return false;
  }

  return 'events' in object && object.events !== '';
}
