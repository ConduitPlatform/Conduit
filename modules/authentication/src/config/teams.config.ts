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
      identityMode: {
        doc: "Identity mode, one of 'shared' or 'isolated'. 'shared': identifiers (email, phone, username, wallet, OAuth id) are unique across the deployment. 'isolated': they are unique per home realm. Returning to 'shared' is refused while any identifier is held by more than one account",
        format: 'String',
        default: 'shared',
        enum: ['shared', 'isolated'],
      },
      discoveryLogin: {
        doc: 'Lets the login routes (local, username, phone, OAuth2) answer with the realms holding an account with the given credentials when called with `discover`, instead of opening a session. Needs realms enabled',
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
