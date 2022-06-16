import winston, { LogCallback, LogEntry, Logger, transports, format } from 'winston';
import { Indexable } from '../interfaces';
import { isEmpty, isNil } from 'lodash';

export class ConduitLogger {
  private readonly _winston: winston.Logger;

  constructor() {
    this._winston = winston.createLogger({
      level: 'debug',
      format: format.combine(
        format.prettyPrint(),
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.printf(({ level, message, label, timestamp, ...meta }) => {
          return `[${timestamp}] [${level.toUpperCase()}]: ${message} ${
            !isEmpty(meta) ? '\n' + JSON.stringify(meta, null, 2) : ''
          }`;
        }),
        format.colorize({
          all: true,
        }),
      ),
      transports: [new transports.Console()],
    });
  }

  log(message: string, level: string = 'info', cb?: LogCallback): Logger {
    return this._winston.log(level, message, cb);
  }

  logObject(
    object: Indexable,
    message: string,
    level: string = 'info',
    cb?: LogCallback,
  ): Logger {
    return this._winston.log(level, message, object, cb);
  }

  info(message: string, cb?: LogCallback): Logger {
    return this._winston.info(message, cb);
  }

  warn(message: string, cb?: LogCallback): Logger {
    return this._winston.warn(message, cb);
  }

  error(message: string, cb?: LogCallback): Logger {
    return this._winston.error(message, cb);
  }

  http(message: string, cb?: LogCallback): Logger {
    return this._winston.http(message, cb);
  }

  verbose(message: string, cb?: LogCallback): Logger {
    return this._winston.verbose(message, cb);
  }
}
