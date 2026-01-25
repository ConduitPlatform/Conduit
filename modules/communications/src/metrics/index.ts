import { MetricType } from '@conduitplatform/grpc-sdk';

export default {
  email_templates_total: {
    type: MetricType.Gauge,
    config: {
      name: 'email_templates_total',
      help: 'Total number of email templates',
    },
  },
  emails_sent_total: {
    type: MetricType.Counter,
    config: {
      name: 'emails_sent_total',
      help: 'Total number of emails sent',
    },
  },
  push_notifications_sent_total: {
    type: MetricType.Counter,
    config: {
      name: 'push_notifications_sent_total',
      help: 'Total number of push notifications sent',
    },
  },
  sms_sent_total: {
    type: MetricType.Counter,
    config: {
      name: 'sms_sent_total',
      help: 'Total number of SMS messages sent',
    },
  },
  communications_sent_total: {
    type: MetricType.Counter,
    config: {
      name: 'communications_sent_total',
      help: 'Total number of communications sent',
    },
  },
  communications_success_total: {
    type: MetricType.Counter,
    config: {
      name: 'communications_success_total',
      help: 'Total number of successful communications',
    },
  },
  communications_failure_total: {
    type: MetricType.Counter,
    config: {
      name: 'communications_failure_total',
      help: 'Total number of failed communications',
    },
  },
  fallback_chain_used_total: {
    type: MetricType.Counter,
    config: {
      name: 'fallback_chain_used_total',
      help: 'Total number of times fallback chain was used',
    },
  },
};
