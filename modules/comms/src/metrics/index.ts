import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  emailTemplates: {
    type: MetricType.Gauge,
    config: {
      name: 'email_templates_total',
      help: 'Tracks the total number of email templates',
    },
  },
  emailsSent: {
    type: MetricType.Counter,
    config: {
      name: 'emails_sent_total',
      help: 'Tracks the total number of emails sent',
    },
  },
  pushNotifications: {
    type: MetricType.Counter,
    config: {
      name: 'push_notifications_sent_total',
      help: 'Tracks the total number of push notifications sent',
    },
  },
  smsSent: {
    type: MetricType.Counter,
    config: {
      name: 'sms_sent_total',
      help: 'Tracks the total number of sms sent',
    },
  },
};
