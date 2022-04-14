export default {
  active: {
    format: 'Boolean',
    default: true,
  },
  allowMessageDelete: {
    format: 'Boolean',
    default: true
  },
  allowMessageEdit: {
    format: 'Boolean',
    default: true
  },
  sendInvitations: {
    enabled: {
      doc: 'Defines if this strategy is active or not',
      format: 'Boolean',
      default: false,
    },
    send_email: {
      doc: 'Defines if the sender should automatically send an invitation e-mail to the user',
      format: 'Boolean',
      default: false,
    },
    send_notification: {
      doc: 'Defines if the sender should automatically send a push notification',
      format: 'Boolean',
      default: false,
    },
    redirect_uri: {
      format: 'String',
      default: '',
    },
  }

};
