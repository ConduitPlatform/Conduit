import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  databaseQueries: {
    type: MetricType.Counter,
    config: {
      name: 'database_queries_total',
      help: 'Tracks the total number of database queries',
    },
  },
  // databaseQueryErrors: {
  //   //TODO: create global query error handler to track this
  //   type: MetricType.Counter,
  //   config: {
  //     name: 'database_query_errors_total',
  //     help: 'Tracks the total number of database query errors',
  //   },
  // },
  registeredSchemas: {
    type: MetricType.Gauge,
    config: {
      name: 'registered_schemas_total',
      help: 'Tracks the total number of registered schemas',
      labelNames: ['imported'],
    },
  },
  customEndpoints: {
    type: MetricType.Gauge,
    config: {
      name: 'custom_endpoints_total',
      help: 'Tracks the total number of custom endpoints',
    },
  },
};
