import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  authzRequests: {
    type: MetricType.Counter,
    config: {
      name: 'authorization_requests_total',
      help: 'Tracks the total number of authorization requests',
    },
  },
  totalRules: {
    type: MetricType.Counter,
    config: {
      name: 'authorization_rules_total',
      help: 'Tracks the total number of stored rules',
    },
  },
  totalRoles: {
    type: MetricType.Counter,
    config: {
      name: 'authorization_roles_total',
      help: 'Tracks the total number of stored roles',
    },
  },
  authzDenials: {
    type: MetricType.Gauge,
    config: {
      name: 'authorization_denials',
      help: 'Tracks the total number of denials in authz requests',
    },
  },
};
