import winston, { Logger } from 'winston';
import { Indexable } from './Indexable.js';

export interface IConduitLogger {
  get winston(): winston.Logger;

  log(message: string, level?: string): Logger;

  logObject(object: Indexable, message?: string, level?: string): Logger;

  info(message: string): Logger;

  warn(message: string): Logger;

  error(messageOrError: string | Error, originalError?: Error): Logger;

  http(message: string): Logger;

  verbose(message: string): Logger;

  addTransport(transport: winston.transport): void;
}
