import { HealthCheckStatus } from '@conduitplatform/grpc-sdk';

export interface IModuleConfig {
  name: string;
  addresses: string;
  instances: {
    instanceId: string;
    address: string;
    url: string;
    status?: HealthCheckStatus;
  }[];
  status?: HealthCheckStatus;
  configSchema?: string;
}
