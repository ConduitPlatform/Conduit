import expressWinston from 'express-winston';
import winston from 'winston';

export class ConduitLogger {
  get middleware() {
    return expressWinston.logger({
      transports: [
        new winston.transports.Console()
      ],
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.cli()
      ),
      meta: false,
      msg: "HTTP {{req.method}} {{req.url}}",
      expressFormat: true,
      colorize: false
    });
  }

  get errorLogger() {
    return expressWinston.errorLogger({
      transports: [
        new winston.transports.Console()
      ],
      format: winston.format.combine(
        winston.format.prettyPrint({colorize: true})
      ),
      meta: false,
    });
  }
}
