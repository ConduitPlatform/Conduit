import { HealthCheckStatus } from '@conduitplatform/grpc-sdk';
import { BasicMessage } from './Basic.message.js';

export type ServiceDiscoverMessage = BasicMessage & {
  name: string;
  url: string;
  status: HealthCheckStatus;
  addressType: 'ipv4' | 'ipv6' | 'dns';
  instanceId: string;
};
