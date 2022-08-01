import { MetricType } from '../../types';

export default {
  grpcRequests: {
    type: MetricType.Counter,
    config: {
      name: 'grpc_requests',
      help: 'Tracks the number of grpc requests',
    },
  },
  clientHttpRequests: {
    type: MetricType.Counter,
    config: {
      name: 'client_http_requests',
      help: 'Tracks the number of the client http requests',
    },
  },
  adminHttpRequests: {
    type: MetricType.Counter,
    config: {
      name: 'admin_http_requests',
      help: 'Tracks the number of the admin http requests',
    },
  },
  clientHttpErrors: {
    type: MetricType.Counter,
    config: {
      name: 'client_http_errors',
      help: 'Tracks the number of client http errors',
    },
  },
  adminHttpErrors: {
    type: MetricType.Counter,
    config: {
      name: 'admin_http_errors',
      help: 'Tracks the number of admin http errors',
    },
  },
  healthState: {
    type: MetricType.Gauge,
    config: {
      name: 'health_state',
      help: 'Tracks the health state of the module',
    },
  },
  requestLatency: {
    type: MetricType.Gauge,
    config: {
      name: 'request_latency',
      help: 'Tracks the latency of http requests',
    },
  },
  httpErrorRate: {
    type: MetricType.Summary,
    config: {
      name: 'http_error_rate',
      help: 'Tracks the error rate of http requests',
      percentiles: [0.5, 0.75, 0.9, 0.95, 0.99, 0.999],
    },
  },
};
