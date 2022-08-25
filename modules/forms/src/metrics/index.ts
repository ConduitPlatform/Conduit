import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  formsCreated: {
    type: MetricType.Gauge,
    config: {
      name: 'forms_total',
      help: 'Tracks the total number of forms created',
    },
  },
};
