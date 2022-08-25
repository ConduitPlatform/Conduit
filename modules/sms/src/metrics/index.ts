import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  smsSent: {
    type: MetricType.Counter,
    config: {
      name: 'sms_sent_total',
      help: 'Tracks the total number of sms sent',
    },
  },
};
