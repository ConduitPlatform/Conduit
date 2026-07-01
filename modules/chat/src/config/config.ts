export default {
  active: {
    format: 'Boolean',
    default: true,
  },
  allowMessageDelete: {
    format: 'Boolean',
    default: true,
  },
  allowMessageEdit: {
    format: 'Boolean',
    default: true,
  },
  deleteEmptyRooms: {
    doc: 'Defines whether rooms should be automatically deleted after all participants have left',
    format: 'Boolean',
    default: false,
  },
  auditMode: {
    doc: 'When audit is enabled, deleted rooms and messages are not actually deleted, but marked as deleted',
    format: 'Boolean',
    default: false,
  },
  explicit_room_joins: {
    enabled: {
      doc: 'Defines whether users should explicitly accept an invitation before being introduced into a chat room',
      format: 'Boolean',
      default: false,
    },
    send_email: {
      doc: 'Defines if the sender should automatically send an invitation e-mail to the user',
      format: 'Boolean',
      default: false,
    },
    send_notification: {
      doc: 'Defines if the sender should automatically send a notification to the user',
      format: 'Boolean',
      default: false,
    },
    redirect: {
      login_uri: {
        doc: 'Where unauthenticated users are redirected before accepting or declining. The hook URL is passed as redirectUri.',
        format: 'String',
        default: '',
        optional: true,
      },
      accept_uri: {
        doc: 'Where users are redirected after accepting an invitation. Supports {roomId} placeholder.',
        format: 'String',
        default: '',
        optional: true,
      },
      decline_uri: {
        doc: 'Where users are redirected after declining an invitation.',
        format: 'String',
        default: '',
        optional: true,
      },
    },
  },
};
