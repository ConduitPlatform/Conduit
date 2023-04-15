import winston, { LogCallback, Logger } from 'winston';
import { Indexable } from './Indexable';

export interface IConduitLogger {
  log(message: string, level?: string, cb?: LogCallback): Logger;

  logObject(object: Indexable, message: string, level: string, cb?: LogCallback): Logger;

  info(message: string, cb?: LogCallback): Logger;

  warn(message: string, cb?: LogCallback): Logger;

  error(message: string | Error, cb?: LogCallback): Logger;

  http(message: string, cb?: LogCallback): Logger;

  verbose(message: string, cb?: LogCallback): Logger;

  addTransport(transport: winston.transport): void;
}
