import { ConduitModel } from './Model';

export interface ConduitSocketOptions {
  path: string;
  name?: string;
  description?: string;
  params?: ConduitModel;
  // middlewares?: string[]; // TODO https://socket.io/docs/v4/middlewares/
}

export type ConduitSocketEventHandlers = { [eventName: string]: string };
