import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  chatRooms: {
    type: MetricType.Gauge,
    config: {
      name: 'chat_rooms_total',
      help: 'Tracks the total number of chat rooms',
    },
  },
  messagesSent: {
    type: MetricType.Counter,
    config: {
      name: 'messages_sent_total',
      help: 'Tracks the total number of messages sent',
    },
  },
};
