import { TYPE } from './Model';

export type ConduitSocketParamTypes = (TYPE | ConduitSocketParamTypes)[];

export interface ConduitSocketOptions {
  path: string;
  name?: string;
  description?: string;
  params?: ConduitSocketParamTypes;
  // middlewares?: string[]; // TODO https://socket.io/docs/v4/middlewares/
}

export type ConduitSocketEventHandlers = { [eventName: string]: string };
