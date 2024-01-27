import ConduitGrpcSdk, {
  IConduitLogger,
  Indexable,
  UntypedArray,
} from '@conduitplatform/grpc-sdk';
import winston, { format, LogCallback, Logger } from 'winston';
import { isEmpty } from 'lodash-es';
import { get } from 'http';
import LokiTransport from 'winston-loki';
import { linearBackoffTimeoutAsync } from '../utilities/index.js';

const processMeta = (meta: Indexable) => {
  if (Array.isArray(meta)) {
    return meta.reduce(
      (message: string, meta: Indexable) =>
        `${message} \n  ${JSON.stringify(meta, null, 2)}`,
      '',
    );
  } else {
    return JSON.stringify(meta, null, 2);
  }
};

const createFormat = (logMeta: boolean = true) => {
  return format.combine(
    format.printf(info => {
      // This will customize the Error Message
      if (info.stack) {
        return `[${info.timestamp}] [${info.level.toUpperCase()}]: ${info.message} ${
          info.stack
        }`;
      }
      if (logMeta) {
        return `[${info.timestamp}] [${info.level.toUpperCase()}]: ${info.message} ${
          !isEmpty(info.meta) ? processMeta(info.meta) : ''
        }`;
      } else {
        return `[${info.timestamp}] [${info.level.toUpperCase()}]: ${info.message}`;
      }
    }),
  );
};
const defaultTransport = new winston.transports.Console({
  level: 'debug',
  format: format.combine(
    format.prettyPrint(),
    format.errors({ stack: true }),
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    createFormat(false),
    format.colorize({
      all: true,
    }),
  ),
});

export class ConduitLogger implements IConduitLogger {
  private readonly _winston: Logger;

  constructor(transports?: winston.transport[]) {
    this._winston = winston.createLogger({
      format: format.combine(
        format.prettyPrint(),
        format.errors({ stack: true }),
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        createFormat(),
      ),
      transports: transports ? [...transports, defaultTransport] : [defaultTransport],
    });
  }

  get winston() {
    return this._winston;
  }

  addTransport(transport: winston.transport) {
    this._winston.add(transport);
  }

  log(message: string, level: string = 'info', cb?: LogCallback): Logger {
    return this._winston.log(level, message, cb);
  }

  logObject(
    object: Indexable,
    message: string = '',
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

  error(message: string | Error, cb?: LogCallback): Logger {
    if (typeof message === 'object') {
      return this._winston.error(message);
    }
    return this._winston.error(message, cb);
  }

  http(message: string, cb?: LogCallback): Logger {
    return this._winston.http(message, cb);
  }

  verbose(message: string, cb?: LogCallback): Logger {
    return this._winston.verbose(message, cb);
  }
}

async function lokiReadyCheck(lokiUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const data: UntypedArray = [];
    get(`${lokiUrl}/ready`, r => {
      r.on('data', chunk => data.push(chunk));
      r.on('end', () => {
        if (Buffer.concat(data).toString() === 'ready\n') resolve();
        else reject(false);
      });
    }).on('error', err => {
      reject(err.message);
    });
  });
}

export async function setupLoki(module: string, instance: string) {
  let lokiUrl = process.env.LOKI_URL;
  if (lokiUrl && lokiUrl !== '') {
    if (lokiUrl.endsWith('/')) lokiUrl = lokiUrl.slice(0, -1);
    const onTry = async () => {
      return await lokiReadyCheck(lokiUrl!)
        .then(() => {
          (ConduitGrpcSdk.Logger as IConduitLogger).addTransport(
            new LokiTransport({
              level: 'debug',
              host: lokiUrl!,
              batching: false,
              replaceTimestamp: true,
              labels: {
                module,
                instance,
                ...(process.env.CONDUIT_NAMESPACE && {
                  namespace: process.env.CONDUIT_NAMESPACE,
                }),
              },
            }),
          );
          return false;
        })
        .catch(() => true); // retry
    };
    const onFailure = () => {
      ConduitGrpcSdk.Logger.error(`Failed to connect to Loki on '${lokiUrl}'`);
    };
    await linearBackoffTimeoutAsync(onTry, 250, 15, onFailure, true);
  }
}
