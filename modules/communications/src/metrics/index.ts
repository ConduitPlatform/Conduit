export default {
  email_templates_total: {
    type: 'gauge',
    help: 'Total number of email templates',
  },
  emails_sent_total: {
    type: 'counter',
    help: 'Total number of emails sent',
  },
  push_notifications_sent_total: {
    type: 'counter',
    help: 'Total number of push notifications sent',
  },
  sms_sent_total: {
    type: 'counter',
    help: 'Total number of SMS messages sent',
  },
  communications_sent_total: {
    type: 'counter',
    help: 'Total number of communications sent',
  },
  communications_success_total: {
    type: 'counter',
    help: 'Total number of successful communications',
  },
  communications_failure_total: {
    type: 'counter',
    help: 'Total number of failed communications',
  },
  fallback_chain_used_total: {
    type: 'counter',
    help: 'Total number of times fallback chain was used',
  },
};
