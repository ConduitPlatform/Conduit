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
  authorizedViewReads: {
    type: MetricType.Counter,
    config: {
      name: 'database_authorized_view_reads_total',
      help: 'MongoDB reads executed directly against an authorization view (no intermediate id $in)',
    },
  },
  authorizedBulkChunks: {
    type: MetricType.Counter,
    config: {
      name: 'database_authorized_bulk_chunks_total',
      help: 'Chunks processed for authorized bulk writes (bounded _id $in per command)',
      labelNames: ['operation', 'schema'],
    },
  },
  authorizedBulkDurationMs: {
    type: MetricType.Histogram,
    config: {
      name: 'database_authorized_bulk_duration_ms',
      help: 'Wall time for authorized bulk write paths that iterate ID batches from the auth view',
      labelNames: ['operation', 'schema'],
      buckets: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 15000, 60000],
    },
  },
  authorizedBulkMaxTotalIdsErrors: {
    type: MetricType.Counter,
    config: {
      name: 'database_authorized_bulk_max_total_ids_errors_total',
      help: 'Authorized bulk operations aborted because CONDUIT_AUTHZ_BULK_MAX_TOTAL_IDS would be exceeded',
      labelNames: ['operation', 'schema'],
    },
  },
};
