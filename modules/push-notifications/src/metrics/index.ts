import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  pushNotifications: {
    type: MetricType.Counter,
    config: {
      name: 'push_notifications_sent_total',
      help: 'Tracks the total number of push notifications sent',
    },
  },
};
