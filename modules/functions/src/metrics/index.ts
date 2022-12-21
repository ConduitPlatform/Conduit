import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  executedFunctions: {
    type: MetricType.Counter,
    config: {
      name: 'executed_functions_total',
      help: 'Tracks the total number of successfully executed functions',
    },
  },
  failedFunctions: {
    type: MetricType.Gauge,
    config: {
      name: 'failed_functions_total',
      help: 'Tracks the total number of failed functions',
    },
  },
};
