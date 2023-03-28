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
  moduleHealthState: {
    type: MetricType.Gauge,
    config: {
      name: 'module_health_state',
      help: 'Tracks the health state of the module',
    },
  },
  grpcRequestLatency: {
    type: MetricType.Gauge,
    config: {
      name: 'grpc_request_latency_seconds',
      help: 'Tracks the latency of grpc requests in seconds',
    },
  },
  adminGrpcRequestLatency: {
    type: MetricType.Gauge,
    config: {
      name: 'admin_grpc_request_latency_seconds',
      help: 'Tracks the latency of admin grpc requests in seconds',
    },
  },
  clientGrpcRequestLatency: {
    type: MetricType.Gauge,
    config: {
      name: 'client_grpc_request_latency_seconds',
      help: 'Tracks the latency of client grpc requests in seconds',
    },
  },
  grpcResponseStatuses: {
    type: MetricType.Counter,
    config: {
      name: 'grpc_response_statuses_total',
      help: 'Tracks the total number of grpc response codes',
      labelNames: ['success'],
    },
  },
  adminGrpcResponseStatuses: {
    type: MetricType.Counter,
    config: {
      name: 'admin_grpc_response_statuses_total',
      help: 'Tracks the total number of admin grpc response codes',
      labelNames: ['success'],
    },
  },
  clientGrpcResponseStatuses: {
    type: MetricType.Counter,
    config: {
      name: 'client_grpc_response_statuses_total',
      help: 'Tracks the total number  of client grpc response codes',
      labelNames: ['success'],
    },
  },
};
