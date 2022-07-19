import expressWinston from 'express-winston';
import winston from 'winston';

export function createRouteMiddleware(winstonInstance: winston.Logger) {
  return expressWinston.logger({
    winstonInstance,
    meta: true,
    msg: 'HTTP {{req.method}} {{req.url}}',
    expressFormat: true,
    colorize: false,
  });
}

export function errorLogger(winstonInstance: winston.Logger) {
  return expressWinston.errorLogger({
    winstonInstance,
    meta: true,
  });
}
