import { MetricType } from '../../types';

export default {
  grpcRequests: {
    type: MetricType.Counter,
    config: {
      name: 'grpc_requests',
      help: 'Tracks the number of grpc requests',
    },
  },
  grpcRequestsPerMinute: {
    type: MetricType.Counter,
    config: {
      name: 'grpc_requests_per_minute',
      help: 'Tracks the number of grpc requests per minute',
    },
  },
  httpRequests: {
    type: MetricType.Counter,
    config: {
      name: 'http_requests',
      help: 'Tracks the number of http requests',
    },
  },
  healthState: {
    type: MetricType.Histogram,
    config: {
      name: 'health_state',
      help: 'Tracks the health state of the module',
      buckets: [0, 1],
    },
  },
  grpcRequestLatency: {
    type: MetricType.Histogram,
    config: {
      name: 'grpc_request_latency',
      help: 'Tracks the latency of grpc requests',
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    },
  },
  httpErrors: {
    type: MetricType.Counter,
    config: {
      name: 'http_errors',
      help: 'Tracks the number of http errors',
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
