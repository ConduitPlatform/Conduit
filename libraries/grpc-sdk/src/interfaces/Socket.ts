import { TYPE } from './Model.js';

export type ConduitSocketParamTypes = (TYPE | ConduitSocketParamTypes)[];

export interface ConduitSocketOptions {
  path: string;
  name?: string;
  description?: string;
  middlewares?: string[];
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
