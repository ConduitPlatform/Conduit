import winston, { LogCallback, LogEntry, Logger, transports, format } from 'winston';

export class ConduitLogger {
  private readonly _winston: winston.Logger;

  constructor() {
    this._winston = winston.createLogger({
      level: 'info',
      format: format.combine(format.cli(), format.prettyPrint(), format.timestamp()),
      transports: [new transports.Console()],
    });
  }

  get winston(): winston.Logger {
    return this._winston;
  }

  log(level: string, message: string, cb?: LogCallback): Logger {
    return this._winston.log(level, message, cb);
  }
  // log(options: LogEntry) {
  //   return this._winston.log(options);
  // }
  info(message: string, cb?: LogCallback): Logger {
    return this._winston.info(message, cb);
  }
  error(message: string, cb?: LogCallback): Logger {
    return this._winston.error(message, cb);
  }
  verbose(message: string, cb?: LogCallback): Logger {
    return this._winston.verbose(message, cb);
  }
}
