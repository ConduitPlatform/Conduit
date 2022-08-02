import { MetricType } from '../../types';

export default {
  internalGrpcRequests: {
    type: MetricType.Counter,
    config: {
      name: 'internal_grpc_requests_total',
      help: "Tracks the total number of Conduit's internal gRPC requests",
    },
  },
  clientGrpcRequests: {
    type: MetricType.Counter,
    config: {
      name: 'client_grpc_requests_total',
      help: 'Tracks the total number of the client gRPC requests',
    },
  },
  adminGrpcRequests: {
    type: MetricType.Counter,
    config: {
      name: 'admin_grpc_requests_total',
      help: 'Tracks the total number of the admin gRPC requests',
    },
  },
  clientGrpcErrors: {
    type: MetricType.Counter,
    config: {
      name: 'client_grpc_errors_total',
      help: 'Tracks the total number of client grpc errors',
    },
  },
  adminGrpcErrors: {
    type: MetricType.Counter,
    config: {
      name: 'admin_grpc_errors_total',
      help: 'Tracks the total number of admin grpc errors',
    },
  },
  healthState: {
    type: MetricType.Gauge,
    config: {
      name: 'health_state_total',
      help: 'Tracks the health state of the module',
    },
  },
  grpcRequestLatency: {
    type: MetricType.Gauge,
    config: {
      name: 'grpc_request_latency_total',
      help: 'Tracks the latency of grpc requests',
    },
  },
  adminHttpErrorRate: {
    type: MetricType.Summary,
    config: {
      name: 'http_error_rate',
      help: 'Tracks the error rate of http requests',
      percentiles: [0.5, 0.75, 0.9, 0.95, 0.99, 0.999],
    },
  },
  clientHttpErrorRate: {
    type: MetricType.Summary,
    config: {
      name: 'client_http_error_rate',
      help: 'Tracks the error rate of client http requests',
      percentiles: [0.5, 0.75, 0.9, 0.95, 0.99, 0.999],
    },
  },
  adminHTTPErrorRate: {
    type: MetricType.Summary,
    config: {
      name: 'admin_http_error_rate',
      help: 'Tracks the error rate of admin http requests',
      percentiles: [0.5, 0.75, 0.9, 0.95, 0.99, 0.999],
    },
  },
};
