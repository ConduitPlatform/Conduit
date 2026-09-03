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
        doc: 'Absolute login page URL for unauthenticated email-link clicks. The invitation hook URL is appended as redirectUri so after login the user returns to the hook authenticated. answer and invitationToken are also appended. Empty means email clicks fail until configured.',
        format: 'String',
        default: '',
        optional: true,
      },
      accept_uri: {
        doc: 'App destination after a successful accept. Supports {roomId} placeholder. Empty returns a JSON result instead of redirecting.',
        format: 'String',
        default: '',
        optional: true,
      },
      decline_uri: {
        doc: 'App destination after a successful decline. Supports {roomId} placeholder. Empty returns a JSON result instead of redirecting.',
        format: 'String',
        default: '',
        optional: true,
      },
    },
  },
};
