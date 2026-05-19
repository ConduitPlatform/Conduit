import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  registeredRoutes: {
    type: MetricType.Gauge,
    config: {
      name: 'admin_routes_total',
      help: 'Tracks the total number of registered admin routes',
      labelNames: ['transport'],
    },
  },
};
