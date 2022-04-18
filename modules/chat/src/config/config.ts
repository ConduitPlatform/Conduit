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
  explicit_room_joins: {
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
  }

};
