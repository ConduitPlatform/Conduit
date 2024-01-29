import ConduitGrpcSdk, {
  HealthCheckStatus,
  IConduitLogger,
} from '@conduitplatform/grpc-sdk';
import { ConduitLogger, setupLoki } from '../logging/index.js';
import winston from 'winston';
import path from 'path';
import { ConduitMetrics } from '../metrics/index.js';
import { clientMiddleware } from '../metrics/clientMiddleware.js';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const initializeSdk = (
  coreUrl: string,
  moduleName: string,
  watchModules: boolean = true,
  serviceHealthStatusGetter: () => HealthCheckStatus = () => HealthCheckStatus.SERVING,
) => {
  let logger: IConduitLogger;
  try {
    logger = new ConduitLogger([
      new winston.transports.File({
        filename: path.join(__dirname, '.logs/combined.log'),
        level: 'info',
      }),
      new winston.transports.File({
        filename: path.join(__dirname, '.logs/errors.log'),
        level: 'error',
      }),
    ]);
  } catch (e) {
    logger = new ConduitLogger();
  }
  const grpcSdk = new ConduitGrpcSdk(
    coreUrl,
    moduleName,
    watchModules,
    logger,
    serviceHealthStatusGetter,
  );
  setupLoki(grpcSdk.name, grpcSdk.instance).then();
  if (process.env.METRICS_PORT) {
    ConduitGrpcSdk.Metrics = new ConduitMetrics(grpcSdk.name, grpcSdk.instance);
    grpcSdk.addMiddleware(clientMiddleware());
  }
  return grpcSdk;
};
