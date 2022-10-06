import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  registeredRoutes: {
    type: MetricType.Gauge,
    config: {
      name: 'client_routes_total',
      help: 'Tracks the total number of registered client routes',
      labelNames: ['transport'],
    },
  },
  securityClients: {
    type: MetricType.Gauge,
    config: {
      name: 'security_clients_total',
      help: 'Tracks the total number of security clients',
      labelNames: ['platform'],
    },
  },
};
