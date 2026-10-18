export default {
  teams: {
    enabled: {
      format: 'Boolean',
      default: false,
    },
    enableDefaultTeam: {
      format: 'Boolean',
      default: false,
    },
    allowAddWithoutInvite: {
      format: 'Boolean',
      default: false,
    },
    allowRegistrationWithoutInvite: {
      format: 'Boolean',
      default: true,
    },
    allowEmailMismatchForInvites: {
      format: 'Boolean',
      default: false,
    },
    realms: {
      enabled: {
        doc: 'Master gate for authentication realms (teams that own their users identity)',
        format: 'Boolean',
        default: false,
      },
      cacheTtlMs: {
        doc: 'In-process cache lifetime for realm lookups, in milliseconds (0 disables caching)',
        format: 'Number',
        default: 5000,
      },
      allowEmailDiscovery: {
        doc: 'Allows resolving the home realm slug of an email address (leaks which realm owns an address)',
        format: 'Boolean',
        default: false,
      },
    },
    invites: {
      enabled: {
        format: 'Boolean',
        default: false,
      },
      sendEmail: {
        format: 'Boolean',
        default: false,
      },
      inviteUrl: {
        format: 'String',
        default: 'https://mydomain.conduit/invite',
      },
    },
  },
};
