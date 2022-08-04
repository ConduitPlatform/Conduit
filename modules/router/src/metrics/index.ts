import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  registeredRoutes: {
    type: MetricType.Counter,
    config: {
      name: 'registered_routes_total',
      help: 'Tracks the total number of registered routes',
    },
  },
  securityClients: {
    type: MetricType.Gauge,
    config: {
      name: 'security_clients_total',
      help: 'Tracks the total number of security clients',
    },
  },
};
