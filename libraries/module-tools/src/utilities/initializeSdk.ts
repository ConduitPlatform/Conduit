import {
  ConduitGrpcSdk,
  HealthCheckStatus,
  IConduitLogger,
} from '@conduitplatform/grpc-sdk';
import { ConduitLogger, setupLoki } from '../logging/index.js';
import { createFileLogTransports } from '../logging/fileTransports.js';
import { ConduitMetrics } from '../metrics/index.js';
import { clientMiddleware } from '../metrics/clientMiddleware.js';

export const initializeSdk = (
  coreUrl: string,
  moduleName: string,
  watchModules: boolean = true,
  serviceHealthStatusGetter: () => HealthCheckStatus = () => HealthCheckStatus.SERVING,
) => {
  let logger: IConduitLogger;
  try {
    const fileTransports = createFileLogTransports();
    logger =
      fileTransports.length > 0 ? new ConduitLogger(fileTransports) : new ConduitLogger();
  } catch {
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
