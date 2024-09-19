import { ConduitService, RoutingManager } from '@conduitplatform/module-tools';
import { HealthCheckStatus } from '@conduitplatform/grpc-sdk';

export interface CommService {
  preConfig?: (config: any) => Promise<any>;
  onConfig?: () => Promise<void>;
  onServerStart?: () => Promise<void>;
  initializeMetrics?: () => Promise<void>;
  registerRoutes?: (_routingManager: RoutingManager) => Promise<void> | void;
  registerAdminRoutes?: (_routingManager: RoutingManager) => Promise<void> | void;

  get rpcFunctions(): ConduitService['functions'];
  get health(): HealthCheckStatus;
}
